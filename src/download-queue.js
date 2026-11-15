import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getBinDir, resolveBinary } from './binary-manager.js';
import { DOWNLOADS_DIR, BIN_DIR, DATA_DIR, ensureDir } from './paths.js';
import {
    isValidVideoUrl,
    sanitizeOutputTemplate,
    filterExtraArgs,
    buildQualityArgs,
    extractFilename,
    createProgressTracker,
} from './ytdlp-args.js';
import { savedOptionsToArgs } from './saved-options.js';
import { getOutputDefaults, defaultContainer } from './output-defaults.js';

// Download jobs run in independent yt-dlp subprocesses; fill every slot by
// default so batches are not serialized. Users can pick 1–10 in Settings.
const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 10;
const MAX_ERROR_LENGTH = 2000;
const MAX_TRACKED_JOBS = 500;
const KILL_ESCALATION_MS = 5000;

let jobs = new Map();
let activeCount = 0;
let maxConcurrency = DEFAULT_CONCURRENCY;
let progressCallbacks = [];
let jobCancelFlags = new Set();

const QUEUE_FILE = process.env.YTDLP_QUEUE_FILE || path.join(DATA_DIR, 'queue.json');
let saveTimer = null;
let lastSavedAt = 0;

function generateId() {
    return crypto.randomUUID();
}

function serializeJobs() {
    return Array.from(jobs.values()).map((job) => {
        const { _process, _killTimer, expectedFiles, fileIndex, ...rest } = job;
        return rest;
    });
}

function saveJobs() {
    try {
        ensureDir(DATA_DIR);
        const tmp = `${QUEUE_FILE}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(serializeJobs()));
        fs.renameSync(tmp, QUEUE_FILE);
        lastSavedAt = Date.now();
    } catch (err) {
        console.error('Failed to persist download queue:', err);
    }
}

// Progress lines arrive constantly; throttle checkpointing to once a second
// while structural changes call saveJobsNow() for immediate durability.
function scheduleSave() {
    if (saveTimer) return;
    const wait = Math.max(0, 1000 - (Date.now() - lastSavedAt));
    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveJobs();
    }, wait);
    if (typeof saveTimer.unref === 'function') saveTimer.unref();
}

function saveJobsNow() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    saveJobs();
}

const VALID_STATUS = new Set(['queued', 'paused', 'completed', 'failed']);

// Restore the queue from disk. A job that was mid-download when the process
// died is re-queued (yt-dlp's --continue picks up its .part files); jobs the
// user explicitly paused stay paused.
function loadPersistedJobs() {
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    } catch {
        return;
    }
    if (!Array.isArray(raw)) return;

    for (const item of raw.slice(-MAX_TRACKED_JOBS)) {
        if (!item || typeof item !== 'object') continue;
        if (typeof item.id !== 'string' || !isValidVideoUrl(item.url)) continue;
        const status = item.status === 'downloading' ? 'queued' : item.status;
        if (!VALID_STATUS.has(status)) continue;
        const options = item.options && typeof item.options === 'object' && !Array.isArray(item.options)
            ? { ...item.options }
            : {};
        if (options.outputTemplate && !sanitizeOutputTemplate(options.outputTemplate)) {
            delete options.outputTemplate;
        }
        jobs.set(item.id, {
            id: item.id,
            url: item.url,
            title: typeof item.title === 'string' ? item.title.slice(0, 300) : item.url,
            status,
            progress: Number.isFinite(item.progress) ? Math.min(100, Math.max(0, item.progress)) : 0,
            createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
            filename: typeof item.filename === 'string' ? item.filename : undefined,
            error: typeof item.error === 'string' ? item.error.slice(0, MAX_ERROR_LENGTH) : undefined,
            options,
            _process: null,
        });
    }
    pruneJobs();
}

function emitProgress(job) {
    const snapshot = { ...job, options: { ...job.options } };
    delete snapshot._process;
    for (const cb of progressCallbacks) {
        try { cb(snapshot); } catch {}
    }
    scheduleSave();
}

// Only emit events for jobs that still exist in the queue, so removed/cancelled
// jobs never resurface as ghost rows in the UI.
function emitIfTracked(job) {
    if (jobs.has(job.id)) emitProgress(job);
}

// Progress regexes expect whole lines; a chunk that splits a "[download]
// Destination:" or "(frag N/M)" line would be missed. Buffer to \n boundaries
// and forward only complete lines, keeping the partial tail for next time.
function makeLineBuffer(onLines) {
    let buf = '';
    return (text) => {
        buf += text;
        const lines = buf.split('\n');
        buf = lines.pop();
        if (lines.length) onLines(lines.join('\n') + '\n');
    };
}

// SIGTERM first; if yt-dlp ignores it (stuck socket, wedged post-processor),
// escalate to SIGKILL so the job's concurrency slot is always released.
function terminateProcess(job) {
    const proc = job._process;
    if (!proc) return;
    try { proc.kill('SIGTERM'); } catch {}
    if (job._killTimer) clearTimeout(job._killTimer);
    job._killTimer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch {}
    }, KILL_ESCALATION_MS);
    if (typeof job._killTimer.unref === 'function') job._killTimer.unref();
}

function clearKillTimer(job) {
    if (job._killTimer) {
        clearTimeout(job._killTimer);
        job._killTimer = null;
    }
}

export function setConcurrency(n) {
    maxConcurrency = Math.max(1, Math.min(MAX_CONCURRENCY, Number(n) || DEFAULT_CONCURRENCY));
    processQueue();
}

export function getConcurrency() {
    return maxConcurrency;
}

export function addJob(url, options = {}) {
    if (!isValidVideoUrl(url)) {
        throw new Error('Invalid URL');
    }
    const outputTemplate = options.outputTemplate;
    if (outputTemplate && !sanitizeOutputTemplate(outputTemplate)) {
        throw new Error('Invalid output template');
    }
    ensureDir(BIN_DIR);
    const id = generateId();
    const { title: titleOption, format: formatOption, audioFormat: audioFormatOption, ...restOptions } = options;
    const defaults = getOutputDefaults();
    const has = (key) => Object.prototype.hasOwnProperty.call(options, key);
    // An explicitly sent 'auto' means "no container constraint" and must not
    // be replaced by the saved default.
    const format = has('format')
        ? (formatOption === 'auto' ? undefined : formatOption)
        : defaultContainer();
    const job = {
        id,
        url,
        title: typeof titleOption === 'string' ? titleOption.slice(0, 300) : url,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
        options: {
            format,
            quality: 'best',
            audioOnly: false,
            audioFormat: has('audioFormat') ? audioFormatOption : defaults.audioFormat,
            ...restOptions,
        },
        _process: null,
    };
    jobs.set(id, job);
    pruneJobs();
    emitProgress(job);
    saveJobsNow();
    processQueue();
    return id;
}

// The jobs map is unbounded state; drop oldest terminal jobs once it grows
// beyond the cap so a spamming client can't grow memory indefinitely.
function pruneJobs() {
    if (jobs.size <= MAX_TRACKED_JOBS) return;
    const terminal = Array.from(jobs.entries())
        .filter(([, j]) => ['completed', 'failed', 'removed'].includes(j.status))
        .sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toDelete = terminal.slice(0, jobs.size - MAX_TRACKED_JOBS);
    for (const [id] of toDelete) {
        jobs.delete(id);
    }
}

export function getJobs() {
    return Array.from(jobs.values()).map(j => {
        const j2 = { ...j };
        delete j2._process;
        return j2;
    });
}

export function getJob(id) {
    const job = jobs.get(id);
    if (!job) return undefined;
    const j2 = { ...job };
    delete j2._process;
    return j2;
}

export function cancelJob(id) {
    const job = jobs.get(id);
    if (!job) return false;
    if (job.status === 'queued') {
        jobs.delete(id);
        emitProgress({ ...job, status: 'removed' });
        saveJobsNow();
        return true;
    }
    if (job.status === 'downloading') {
        jobCancelFlags.add(id);
        job.status = 'paused';
        emitProgress(job);
        saveJobsNow();
        terminateProcess(job);
        return true;
    }
    return false;
}

export function deleteJob(id) {
    const job = jobs.get(id);
    if (!job) return false;
    if (job.status === 'downloading') {
        jobCancelFlags.add(id);
        terminateProcess(job);
    }
    jobs.delete(id);
    emitProgress({ ...job, status: 'removed' });
    saveJobsNow();
    return true;
}

export function clearJobs(filter) {
    const ids = Array.from(jobs.entries())
        .filter(([, j]) => !filter || filter === 'all' || j.status === filter)
        .map(([id]) => id);
    for (const id of ids) {
        deleteJob(id);
    }
    return ids.length;
}

export function resumeJob(id) {
    const job = jobs.get(id);
    if (!job || job.status !== 'paused') return false;
    job.status = 'queued';
    job.progress = 0;
    emitProgress(job);
    saveJobsNow();
    processQueue();
    return true;
}

export function cancelAll() {
    const ids = Array.from(jobs.keys());
    for (const id of ids) {
        cancelJob(id);
    }
}

// Server shutdown: stop children without destroying the queue. In-flight jobs
// become queued again (yt-dlp --continue resumes them on the next boot) while
// explicit pauses are preserved.
export function shutdownQueue() {
    for (const job of jobs.values()) {
        if (job.status !== 'downloading') continue;
        jobCancelFlags.add(job.id);
        job.status = 'queued';
        terminateProcess(job);
    }
    saveJobsNow();
}

export function onProgress(callback) {
    progressCallbacks.push(callback);
    return () => {
        progressCallbacks = progressCallbacks.filter(cb => cb !== callback);
    };
}

// Fills every free slot: while fewer than maxConcurrency jobs are running,
// start the next queued job.
export function processQueue() {
    while (activeCount < maxConcurrency) {
        const queued = Array.from(jobs.values()).find(j => j.status === 'queued');
        if (!queued) break;
        activeCount++;
        queued.status = 'downloading';
        queued.progress = 0;
        emitProgress(queued);
        executeJob(queued)
            .catch((err) => {
                if (jobs.has(queued.id) && queued.status === 'downloading') {
                    queued.status = 'failed';
                    queued.error = String(err?.message || err).slice(0, MAX_ERROR_LENGTH);
                    emitProgress(queued);
                }
            })
            .finally(() => {
                activeCount--;
                processQueue();
            });
    }
}

async function executeJob(job) {
    try {
        const binDir = getBinDir();
        const ytdlpBin = resolveBinary('yt-dlp');
        const downloadsDir = DOWNLOADS_DIR;
        ensureDir(downloadsDir);

        if (!isValidVideoUrl(job.url)) {
            job.status = 'failed';
            job.error = 'Invalid URL';
            emitProgress(job);
            return;
        }

        const extraArgs = [
            ...filterExtraArgs(job.options.extraArgs),
            ...savedOptionsToArgs(),
        ];
        const args = buildQualityArgs(job.options, { binDir, downloadsDir, extraArgs });
        args.push('--newline', '--progress', '--no-simulate');
        args.push('--print', 'after_move:filename');
        args.push('--', job.url);

        return await new Promise((resolve) => {
            const proc = spawn(ytdlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            job._process = proc;
            let filename = '';
            let errData = '';

            // Depending on flags, yt-dlp emits "[download] x%" progress lines
            // on stdout (measured empirically with --print + --no-simulate)
            // or stderr — so watch both.
            const expectedFiles = job.options.audioOnly ? 1 : 2;
            job.expectedFiles = expectedFiles;
            job.fileIndex = 1;
            const trackProgress = createProgressTracker(job, expectedFiles);
            const trackStdout = makeLineBuffer((lines) => { if (trackProgress(lines)) emitIfTracked(job); });
            const trackStderr = makeLineBuffer((lines) => { if (trackProgress(lines)) emitIfTracked(job); });

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                trackStdout(text);
                // Keep a rolling tail: the final `--print after_move:filename`
                // line is always the last stdout output, so never let older
                // progress noise push it out of the buffer.
                if (filename.length + text.length > 200000) {
                    filename = filename.slice(-100000);
                }
                filename += text;
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                trackStderr(text);
                if (errData.length < 50000) errData += text;
            });

            proc.on('close', (code) => {
                job._process = null;
                clearKillTimer(job);
                const wasCancelled = jobCancelFlags.has(job.id);
                jobCancelFlags.delete(job.id);

                if (wasCancelled) {
                    emitIfTracked(job);
                } else if (code === 0) {
                    job.status = 'completed';
                    job.progress = 100;
                    job.filename = extractFilename(filename);
                    emitIfTracked(job);
                } else {
                    job.status = 'failed';
                    job.error = (errData.trim() || `Exit code ${code}`).slice(0, MAX_ERROR_LENGTH);
                    emitIfTracked(job);
                }
                saveJobsNow();
                resolve();
            });

            proc.on('error', (err) => {
                job._process = null;
                clearKillTimer(job);
                jobCancelFlags.delete(job.id);
                job.status = 'failed';
                job.error = String(err.message).slice(0, MAX_ERROR_LENGTH);
                emitIfTracked(job);
                saveJobsNow();
                resolve();
            });
        });
    } catch (err) {
        // Never let a setup failure escape: it would become an unhandled
        // rejection and leak the queue slot permanently. Guard against ghost
        // events (job removed mid-setup) and don't clobber a cancelled job's
        // paused status.
        if (jobs.has(job.id) && (job.status === 'downloading' || job.status === 'queued')) {
            job.status = 'failed';
            job.error = String(err?.message || err).slice(0, MAX_ERROR_LENGTH);
            emitIfTracked(job);
            saveJobsNow();
        }
    }
}

// Restore persisted jobs (if any) and immediately fill the free slots so a
// restart continues queued/interrupted downloads.
loadPersistedJobs();
processQueue();
