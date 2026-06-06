import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getBinDir, ensureBinDir } from './binary-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;

let jobs = new Map();
let activeCount = 0;
let maxConcurrency = DEFAULT_CONCURRENCY;
let progressCallbacks = [];
let jobCancelFlags = new Set();

const QUALITY_MAP = {
    best: 'bestvideo+bestaudio/best',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
};

const DANGEROUS_FLAGS = ['--exec', '--exec-before-download', '--postprocessor-args', '--ppa', '--external-downloader-args', '--downloader-args'];

function generateId() {
    return crypto.randomUUID();
}

function emitProgress(job) {
    const snapshot = { ...job, options: { ...job.options } };
    for (const cb of progressCallbacks) {
        try { cb(snapshot); } catch {}
    }
}

export function setConcurrency(n) {
    maxConcurrency = Math.max(1, Math.min(MAX_CONCURRENCY, n));
}

export function getConcurrency() {
    return maxConcurrency;
}

export function addJob(url, options = {}) {
    ensureBinDir();
    const id = generateId();
    const job = {
        id,
        url,
        title: url,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
        options: {
            format: 'mp4',
            quality: 'best',
            audioOnly: false,
            audioFormat: 'mp3',
            ...options,
        },
        _process: null,
    };
    jobs.set(id, job);
    emitProgress(job);
    processQueue();
    return id;
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
        emitProgress({ ...job, status: 'failed', error: 'Cancelled' });
        return true;
    }
    if (job.status === 'downloading') {
        jobCancelFlags.add(id);
        if (job._process) {
            try { job._process.kill('SIGTERM'); } catch {}
        }
        return true;
    }
    return false;
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

async function processQueue() {
    if (activeCount >= maxConcurrency) return;

    const queued = Array.from(jobs.values()).find(j => j.status === 'queued');
    if (!queued) return;

    activeCount++;
    queued.status = 'downloading';
    queued.progress = 0;
    emitProgress(queued);
    await executeJob(queued);
    activeCount--;
    processQueue();
}

async function executeJob(job) {
    const binDir = getBinDir();
    const ytdlpBin = path.join(binDir, 'yt-dlp');
    const downloadsDir = path.join(projectRoot, 'downloads');

    if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const args = ['--no-warnings', '--ffmpeg-location', binDir, '-P', downloadsDir];

    const { format, quality, audioOnly, audioFormat, outputTemplate, extraArgs } = job.options;

    if (audioOnly) {
        args.push('--extract-audio');
        args.push('--audio-format', audioFormat || 'mp3');
        args.push('-o', outputTemplate || '%(title)s.%(ext)s');
    } else {
        const ext = format || 'mp4';
        if (format || quality) {
            const baseSelector = QUALITY_MAP[quality] || QUALITY_MAP.best;
            const selector = baseSelector.replace('/best', `[ext=${ext}]/best`).replace('bestvideo', `bestvideo[ext=${ext}]`).replace('bestaudio', `bestaudio[ext=${ext}]`);
            args.push('-f', selector);
        } else {
            args.push('-f', 'best');
        }
        args.push('-o', outputTemplate || '%(title)s.%(ext)s');
    }

    if (extraArgs) {
        let entries;
        if (Array.isArray(extraArgs)) {
            entries = extraArgs;
        } else {
            entries = Object.entries(extraArgs).map(([k, v]) => v === true ? k : [k, String(v)]).flat();
        }
        const filtered = [];
        for (let i = 0; i < entries.length; i++) {
            const flag = entries[i];
            const isDangerous = DANGEROUS_FLAGS.some(df => flag === df || flag.startsWith(df + '=') || flag.startsWith('--' + df));
            if (isDangerous) {
                if (typeof entries[i+1] === 'string' && !entries[i+1].startsWith('-')) i++;
                continue;
            }
            filtered.push(flag);
        }
        args.push(...filtered);
    }

    args.push('--newline');
    args.push('--progress');
    args.push(job.url);

    return new Promise((resolve) => {
        const proc = spawn(ytdlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        job._process = proc;
        let filename = '';
        let errData = '';

        proc.stdout.on('data', (data) => {
            const text = data.toString();
            filename += text;
        });

        proc.stderr.on('data', (data) => {
            const text = data.toString();
            errData += text;

            const progressMatch = text.match(/\[download\]\s+(\d+\.?\d*)%/);
            if (progressMatch) {
                const pct = Math.round(parseFloat(progressMatch[1]));
                if (pct !== job.progress) {
                    job.progress = pct;
                    emitProgress(job);
                }
            }
        });

        proc.on('close', (code) => {
            job._process = null;
            jobCancelFlags.delete(job.id);

            if (code === 0) {
                job.status = 'completed';
                job.progress = 100;
                const lines = filename.trim().split('\n');
                job.filename = path.basename(lines[lines.length - 1].trim());
            } else {
                job.status = 'failed';
                job.error = errData.trim() || `Exit code ${code}`;
            }
            emitProgress(job);
            resolve();
        });

        proc.on('error', (err) => {
            job._process = null;
            jobCancelFlags.delete(job.id);
            job.status = 'failed';
            job.error = err.message;
            emitProgress(job);
            resolve();
        });
    });
}
