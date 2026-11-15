import { spawn } from 'child_process';
import crypto from 'crypto';
import { getBinDir, resolveBinary } from './binary-manager.js';
import { DOWNLOADS_DIR, BIN_DIR, ensureDir } from './paths.js';
import {
    isValidVideoUrl,
    sanitizeOutputTemplate,
    filterExtraArgs,
    buildQualityArgs,
    extractFilename,
    createProgressTracker,
} from './ytdlp-args.js';
import { savedOptionsToArgs } from './saved-options.js';

const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const MAX_ERROR_LENGTH = 2000;
const MAX_TRACKED_JOBS = 500;
const KILL_ESCALATION_MS = 5000;

let jobs = new Map();
let activeCount = 0;
let maxConcurrency = DEFAULT_CONCURRENCY;
let progressCallbacks = [];
let jobCancelFlags = new Set();

function generateId() {
    return crypto.randomUUID();
}

function emitProgress(job) {
    const snapshot = { ...job, options: { ...job.options } };
    delete snapshot._process;
    for (const cb of progressCallbacks) {
        try { cb(snapshot); } catch {}
    }
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
    const { title: titleOption, ...restOptions } = options;
    const job = {
        id,
        url,
        title: typeof titleOption === 'string' ? titleOption.slice(0, 300) : url,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
        options: {
            format: 'mp4',
            quality: 'best',
            audioOnly: false,
            audioFormat: 'mp3',
            ...restOptions,
        },
        _process: null,
    };
    jobs.set(id, job);
    pruneJobs();
    emitProgress(job);
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
        return true;
    }
    if (job.status === 'downloading') {
        jobCancelFlags.add(id);
        job.status = 'paused';
        emitProgress(job);
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
    processQueue();
    return true;
}

export function cancelAll() {
    const ids = Array.from(jobs.keys());
    for (const id of ids) {
        cancelJob(id);
    }
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
                resolve();
            });

            proc.on('error', (err) => {
                job._process = null;
                clearKillTimer(job);
                jobCancelFlags.delete(job.id);
                job.status = 'failed';
                job.error = String(err.message).slice(0, MAX_ERROR_LENGTH);
                emitIfTracked(job);
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
        }
    }
}
