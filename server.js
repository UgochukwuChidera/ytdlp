import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import {
    checkBinaries,
    getBinDir,
    resolveBinary,
    downloadYtdlp,
    downloadFfmpeg,
    getLatestYtdlpVersion,
    getLatestFfmpegVersion,
} from './src/binary-manager.js';
import { DOWNLOADS_DIR, BIN_DIR, DATA_DIR } from './src/paths.js';
import https from 'node:https';
import {
    addJob,
    getJobs,
    getJob,
    cancelJob,
    cancelAll,
    deleteJob,
    clearJobs,
    resumeJob,
    onProgress,
    processQueue,
    getConcurrency,
    setConcurrency,
} from './src/download-queue.js';
import {
    subscribe,
    unsubscribe,
    getSubscriptions,
    getChannel,
    updateChannel,
    scrapeChannelVideos,
} from './src/channel-manager.js';
import { YTDLP_OPTIONS } from './src/ytdlp-options.js';
import {
    isValidVideoUrl,
    sanitizeOutputTemplate,
    filterExtraArgs,
    buildQualityArgs,
    extractFilename,
} from './src/ytdlp-args.js';
import {
    applySavedOptions,
    resetSavedOptions,
    getSavedOptions,
    savedOptionsToArgs,
} from './src/saved-options.js';
import { dumpJson } from './src/ytdlp-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadsDir = DOWNLOADS_DIR;

const app = express();

// The Vue app is served same-origin, so no cross-origin API access is needed.
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
// DNS-rebinding guard: a malicious page can rebind its domain to 127.0.0.1
// and then read the loopback API same-origin. Reject any Host we don't serve.
// req.hostname strips the port and handles IPv6 brackets correctly.
const ALLOWED_HOSTS = new Set(
    (process.env.ALLOWED_HOSTS || 'localhost,127.0.0.1,::1,ytdlp.local')
        .split(',')
        .map(h => h.trim().toLowerCase())
        .filter(Boolean)
);
app.use((req, res, next) => {
    const host = (req.hostname || '').toLowerCase();
    if (host && !ALLOWED_HOSTS.has(host)) {
        return res.status(403).json({ error: 'Forbidden host' });
    }
    next();
});
// HTTPS: when the local CA + server cert exist (npm run tls:install), serve
// TLS on 443 and bounce plain HTTP on port 80 over to it. Port 4444 keeps
// serving plain HTTP (bookmarks, curl status checks, dev tooling).
const TLS_DIR = process.env.TLS_DIR || path.join(DATA_DIR, 'tls');
const TLS_CERT = path.join(TLS_DIR, 'server.crt');
const TLS_KEY = path.join(TLS_DIR, 'server.key');
const tlsEnabled = process.env.TLS !== '0' && fs.existsSync(TLS_CERT) && fs.existsSync(TLS_KEY);
const tlsOptions = tlsEnabled ? { key: fs.readFileSync(TLS_KEY), cert: fs.readFileSync(TLS_CERT) } : null;
if (tlsEnabled) {
    app.use((req, res, next) => {
        if (req.socket.localPort === 80 && req.hostname) {
            return res.redirect(308, `https://${String(req.headers.host).replace(/:80$/, '')}${req.originalUrl}`);
        }
        next();
    });
}
app.use(express.json());
// Express 5 leaves req.body undefined for non-JSON content types; routes
// destructure it directly, so default to {} to fail cleanly instead of 500.
app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
});
const vueDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(vueDist));

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

// Resolve a request filename to a path strictly inside the downloads dir.
// Rejects path separators and traversal segments.
function safeFilePath(filename) {
    if (typeof filename !== 'string') return null;
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return null;
    const resolved = path.resolve(downloadsDir, filename);
    if (path.dirname(resolved) !== path.resolve(downloadsDir)) return null;
    return resolved;
}

app.get('/api/status', (req, res) => {
    try {
        const binaries = checkBinaries();
        const jobs = getJobs();
        const concurrency = getConcurrency();

        res.json({
            binaries,
            binDir: BIN_DIR,
            queue: {
                jobs,
                concurrency,
                active: jobs.filter(j => j.status === 'downloading').length,
                queued: jobs.filter(j => j.status === 'queued').length,
                completed: jobs.filter(j => j.status === 'completed').length,
                failed: jobs.filter(j => j.status === 'failed').length,
            },
            options: deepClone(YTDLP_OPTIONS),
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

app.get('/api/updates', async (req, res) => {
    try {
        const binaries = checkBinaries();
        const [latestYtdlp, latestFfmpeg] = await Promise.all([
            getLatestYtdlpVersion(),
            getLatestFfmpegVersion(),
        ]);

        const ytDlpBin = binaries.find(b => b.name === 'yt-dlp');
        const ffmpegBin = binaries.find(b => b.name === 'ffmpeg');

        function isUpdateAvailable(installed, latest) {
            // Can't determine update if either version is missing/unknown
            if (!installed || !latest || latest === 'unknown') return false;
            // versionLte returns null when the formats are incomparable
            // (e.g. git build vs date build) — treat that as "no update info".
            const lte = versionLte(installed, latest);
            return lte === false;
        }

        res.json({
            ytDlp: {
                installed: ytDlpBin?.version || null,
                latest: latestYtdlp,
                updateAvailable: isUpdateAvailable(ytDlpBin?.version, latestYtdlp),
            },
            ffmpeg: {
                installed: ffmpegBin?.version || null,
                latest: latestFfmpeg,
                updateAvailable: isUpdateAvailable(ffmpegBin?.version, latestFfmpeg),
            },
        });
    } catch (error) {
        console.error('Update check error:', error);
        res.status(500).json({ error: 'Failed to check for updates' });
    }
});

// Returns true if current <= latest, false if current is newer,
// and null when the version formats cannot be compared.
function versionLte(current, latest) {
    if (!current || !latest || current === 'unknown' || latest === 'unknown') return false;

    // Compare ffmpeg build dates (installed: "N-125118-g...-20260619",
    // latest release: "2026-06-19").
    const dateOf = (v) => {
        let m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        m = String(v).match(/(\d{8})$/);
        if (m) {
            const s = m[1];
            return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        }
        return null;
    };
    const currentDate = dateOf(current);
    const latestDate = dateOf(latest);
    if (currentDate && latestDate) {
        return currentDate <= latestDate;
    }
    // Only compare dates when both sides carry one; a git-hash version
    // and a semver never mix.
    if (currentDate !== latestDate) return null;

    const parse = (v) => v.split(/[. ]/).map(s => {
        const n = parseInt(s, 10);
        return Number.isNaN(n) ? null : n;
    });
    const curParts = parse(current);
    const latParts = parse(latest);
    if (curParts.some(p => p === null) || latParts.some(p => p === null)) return null;
    for (let i = 0; i < Math.max(curParts.length, latParts.length); i++) {
        const c = curParts[i] ?? 0;
        const l = latParts[i] ?? 0;
        if (c < l) return true;
        if (c > l) return false;
    }
    return true;
}

// Cross-site <img>/EventSource requests can trigger binary downloads from any
// webpage (same Host, so the rebinding guard doesn't apply). Modern browsers
// always send Sec-Fetch-Site; enforce it when present.
function isSameOriginFetch(req) {
    const site = req.headers['sec-fetch-site'];
    return !site || site === 'same-origin' || site === 'none';
}

app.get('/api/setup', async (req, res) => {
    if (!isSameOriginFetch(req)) return res.status(403).json({ error: 'Cross-site setup requests are not allowed' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let sendMsg = (msg) => {
        try { res.write(`data: ${JSON.stringify(msg)}\n\n`); } catch {}
    };

    req.on('close', () => {
        sendMsg = () => {};
    });

    try {
        const binaries = checkBinaries();
        sendMsg({ step: 'check', status: 'done', binaries });

        const [latestYtdlp, latestFfmpeg] = await Promise.all([
            getLatestYtdlpVersion(),
            getLatestFfmpegVersion(),
        ]);

        sendMsg({
            step: 'updates',
            status: 'done',
            updates: {
                ytDlp: {
                    latest: latestYtdlp,
                    current: binaries.find(b => b.name === 'yt-dlp')?.version || null,
                },
                ffmpeg: {
                    latest: latestFfmpeg,
                    current: binaries.find(b => b.name === 'ffmpeg')?.version || null,
                },
            },
        });

        sendMsg({ step: 'download', status: 'starting' });

        const currentBinaries = checkBinaries();
        const curYtdlp = currentBinaries.find(b => b.name === 'yt-dlp');
        const curFfmpeg = currentBinaries.find(b => b.name === 'ffmpeg');

        if (curYtdlp && !curYtdlp.corrupt && versionLte(curYtdlp.version, latestYtdlp) === true) {
            sendMsg({ step: 'yt-dlp', status: 'done', percent: 100, skipped: true });
        } else {
            await downloadYtdlp((name, percent) => {
                sendMsg({ step: name, status: 'downloading', percent });
            });
            sendMsg({ step: 'yt-dlp', status: 'done', percent: 100 });
        }

        if (curFfmpeg && !curFfmpeg.corrupt && versionLte(curFfmpeg.version, latestFfmpeg) === true) {
            sendMsg({ step: 'ffmpeg', status: 'done', percent: 100, skipped: true });
        } else {
            await downloadFfmpeg((name, percent) => {
                sendMsg({ step: name, status: 'downloading', percent });
            });
            sendMsg({ step: 'ffmpeg', status: 'done', percent: 100 });
        }

        sendMsg({ step: 'all', status: 'done' });
        res.end();
    } catch (err) {
        console.error('Setup error:', err);
        sendMsg({ step: 'error', error: err.message });
        res.end();
    }
});

app.get('/api/setup/download/:binary', async (req, res) => {
    if (!isSameOriginFetch(req)) return res.status(403).json({ error: 'Cross-site setup requests are not allowed' });
    const { binary } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let sendMsg = (msg) => {
        try { res.write(`data: ${JSON.stringify(msg)}\n\n`); } catch {}
    };

    req.on('close', () => {
        sendMsg = () => {};
    });

    try {
        const currentBinaries = checkBinaries();

        if (binary === 'yt-dlp') {
            const cur = currentBinaries.find(b => b.name === 'yt-dlp');
            const latestVersion = await getLatestYtdlpVersion();
            if (cur && !cur.corrupt && versionLte(cur.version, latestVersion) === true) {
                sendMsg({ step: 'yt-dlp', status: 'done', percent: 100, skipped: true });
            } else {
                sendMsg({ step: 'yt-dlp', status: 'starting', percent: 0 });
                await downloadYtdlp((name, pct) => {
                    sendMsg({ step: 'yt-dlp', status: 'downloading', percent: pct });
                });
                sendMsg({ step: 'yt-dlp', status: 'done', percent: 100 });
            }
        } else if (binary === 'ffmpeg' || binary === 'ffprobe') {
            const cur = currentBinaries.find(b => b.name === 'ffmpeg');
            const latestFfmpegVersion = await getLatestFfmpegVersion();
            if (cur && !cur.corrupt && versionLte(cur.version, latestFfmpegVersion) === true) {
                sendMsg({ step: 'ffmpeg', status: 'done', percent: 100, skipped: true });
            } else {
                sendMsg({ step: 'ffmpeg', status: 'starting', percent: 0 });
                await downloadFfmpeg((name, pct) => {
                    sendMsg({ step: 'ffmpeg', status: 'downloading', percent: pct });
                });
                sendMsg({ step: 'ffmpeg', status: 'done', percent: 100 });
            }
        } else {
            sendMsg({ step: 'error', error: `Unknown binary: ${binary}` });
            res.end();
            return;
        }
        sendMsg({ step: 'all', status: 'done' });
        res.end();
    } catch (err) {
        console.error(`${binary} download error:`, err);
        sendMsg({ step: 'error', error: err.message });
        res.end();
    }
});

app.get('/api/options', (req, res) => {
    res.json({ _platform: process.platform, ...deepClone(YTDLP_OPTIONS), saved: getSavedOptions() });
});

app.get('/api/format-list', async (req, res) => {
    const { url } = req.query;
    if (!isValidVideoUrl(url)) return res.status(400).json({ error: 'URL is required' });

    try {
        const data = await dumpJson(url, ['--no-playlist']);
        const formats = Array.isArray(data) ? data : (data.formats || []);
        res.json(formats);
    } catch (error) {
        console.error('Format list error:', error);
        res.status(500).json({ error: 'Failed to fetch format list' });
    }
});

app.get('/api/metadata', async (req, res) => {
    const { url } = req.query;
    if (!isValidVideoUrl(url)) return res.status(400).json({ error: 'URL is required' });

    try {
        const metadata = await dumpJson(url, ['--prefer-free-formats', '--youtube-skip-dash-manifest']);
        res.json(metadata);
    } catch (error) {
        console.error('Metadata fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});

app.get('/api/scrape', async (req, res) => {
    const { url } = req.query;
    if (!isValidVideoUrl(url)) return res.status(400).json({ error: 'URL is required' });

    try {
        const data = await dumpJson(url, ['--flat-playlist']);
        res.json(data);
    } catch (error) {
        console.error('Scrape error:', error);
        res.status(500).json({ error: 'Failed to scrape URL' });
    }
});

app.post('/api/download', (req, res) => {
    const { url } = req.body;
    if (!isValidVideoUrl(url)) {
        return res.status(400).json({ error: 'A valid http(s) URL is required' });
    }

    const { outputTemplate, extraArgs, format, quality, audioOnly, audioFormat } = req.body;
    if (outputTemplate && !sanitizeOutputTemplate(outputTemplate)) {
        return res.status(400).json({ error: 'Invalid output template' });
    }

    try {
        const ytdlpBin = resolveBinary('yt-dlp');
        if (!fs.existsSync(ytdlpBin)) {
            return res.status(500).json({ error: 'yt-dlp binary not found. Please run setup first.' });
        }

        const binDir = getBinDir();
        const extraArgsFiltered = [
            ...filterExtraArgs(extraArgs),
            ...savedOptionsToArgs(),
        ];
        const args = buildQualityArgs(
            { format, quality, audioOnly, audioFormat, outputTemplate },
            { binDir, downloadsDir, extraArgs: extraArgsFiltered },
        );
        args.push('--print', 'after_move:filename');
        args.push('--no-simulate');
        // `--` ensures the URL can never be parsed as a yt-dlp flag.
        args.push('--', url);

        const subprocess = spawn(ytdlpBin, args);
        let filename = '';
        let errData = '';

        // If the client aborts (navigated away, closed the tab), don't leave
        // yt-dlp running to completion unmonitored.
        req.on('close', () => {
            if (!res.writableEnded) {
                try { subprocess.kill('SIGTERM'); } catch {}
            }
        });

        subprocess.stdout.on('data', (data) => {
            const text = data.toString();
            // Rolling tail: the final filename print is always the last
            // stdout output, so don't let progress noise push it out.
            if (filename.length + text.length > 200000) {
                filename = filename.slice(-100000);
            }
            filename += text;
        });

        subprocess.stderr.on('data', (data) => {
            if (errData.length < 50000) errData += data.toString();
            console.error(`yt-dlp stderr: ${data}`);
        });

        subprocess.on('close', (code) => {
            if (res.writableEnded) return;
            if (code === 0) {
                res.json({ success: true, filename: extractFilename(filename) });
            } else {
                console.error('yt-dlp exited with code', code);
                res.status(500).json({ error: 'Download failed', details: errData.slice(0, 2000) });
            }
        });

        subprocess.on('error', (err) => {
            console.error('Subprocess error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to initiate download' });
            }
        });
    } catch (error) {
        console.error('Download init error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to initiate download' });
        }
    }
});

app.post('/api/download/queue/cancel-all', (req, res) => {
    try {
        cancelAll();
        res.json({ success: true, message: 'All jobs cancelled' });
    } catch (error) {
        console.error('Cancel all error:', error);
        res.status(500).json({ error: 'Failed to cancel all jobs' });
    }
});

// Cancel (pause) a single job without removing it from the queue.
app.post('/api/download/queue/cancel/:id', (req, res) => {
    try {
        const ok = cancelJob(req.params.id);
        if (!ok) return res.status(400).json({ error: 'Job not found or not cancellable' });
        res.json({ success: true, message: 'Job paused' });
    } catch (error) {
        console.error('Queue cancel error:', error);
        res.status(500).json({ error: 'Failed to cancel job' });
    }
});

app.get('/api/download/queue/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const currentJobs = getJobs();
    res.write(`data: ${JSON.stringify({ type: 'init', jobs: currentJobs })}\n\n`);

    const unsub = onProgress((job) => {
        try { res.write(`data: ${JSON.stringify({ type: 'update', job })}\n\n`); } catch {}
    });

    req.on('close', () => {
        unsub();
    });
});

app.post('/api/download/queue', (req, res) => {
    const { url } = req.body;
    if (!isValidVideoUrl(url)) {
        return res.status(400).json({ error: 'A valid http(s) URL is required' });
    }
    if (req.body.outputTemplate && !sanitizeOutputTemplate(req.body.outputTemplate)) {
        return res.status(400).json({ error: 'Invalid output template' });
    }

    try {
        const id = addJob(url, req.body);
        const job = getJob(id);
        res.status(201).json({ jobId: id, job });
    } catch (error) {
        console.error('Queue add error:', error);
        res.status(500).json({ error: 'Failed to queue download' });
    }
});

app.post('/api/download/queue/batch', (req, res) => {
    const { urls, title } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'URLs array is required' });
    }
    if (!urls.every(isValidVideoUrl)) {
        return res.status(400).json({ error: 'All URLs must be valid http(s) URLs' });
    }
    if (req.body.outputTemplate && !sanitizeOutputTemplate(req.body.outputTemplate)) {
        return res.status(400).json({ error: 'Invalid output template' });
    }
    try {
        const titles = Array.isArray(req.body.titles) ? req.body.titles : [];
        const jobs = urls.map((url, i) => {
            const id = addJob(url, {
                format: req.body.format,
                quality: req.body.quality,
                audioOnly: req.body.audioOnly,
                audioFormat: req.body.audioFormat,
                outputTemplate: req.body.outputTemplate,
                options: req.body.options,
                title: (typeof titles[i] === 'string' && titles[i]) || title || url,
            });
            return { jobId: id, url };
        });
        res.status(201).json({ jobs, count: jobs.length });
    } catch (error) {
        console.error('Batch queue error:', error);
        res.status(500).json({ error: 'Failed to queue batch downloads' });
    }
});

app.get('/api/download/queue', (req, res) => {
    try {
        const jobs = getJobs();
        res.json({ jobs });
    } catch (error) {
        console.error('Queue list error:', error);
        res.status(500).json({ error: 'Failed to list queue' });
    }
});

app.get('/api/download/queue/:id', (req, res) => {
    try {
        const job = getJob(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json({ job });
    } catch (error) {
        console.error('Queue get error:', error);
        res.status(500).json({ error: 'Failed to get job' });
    }
});

app.delete('/api/download/queue/:id', (req, res) => {
    try {
        const removed = deleteJob(req.params.id);
        if (!removed) return res.status(404).json({ error: 'Job not found' });
        res.json({ success: true, message: 'Job removed' });
    } catch (error) {
        console.error('Queue delete error:', error);
        res.status(500).json({ error: 'Failed to remove job' });
    }
});

app.post('/api/download/queue/clear', (req, res) => {
    try {
        const { status } = req.body;
        const count = clearJobs(status || 'all');
        res.json({ success: true, cleared: count });
    } catch (error) {
        console.error('Queue clear error:', error);
        res.status(500).json({ error: 'Failed to clear jobs' });
    }
});

app.post('/api/download/queue/resume/:id', (req, res) => {
    try {
        const ok = resumeJob(req.params.id);
        if (!ok) return res.status(404).json({ error: 'Job not found or not paused' });
        res.json({ success: true, message: 'Job resumed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resume job' });
    }
});

app.post('/api/download/queue/start-all', (req, res) => {
    try {
        processQueue();
        res.json({ success: true, message: 'Starting queued jobs' });
    } catch (error) {
        console.error('Queue start error:', error);
        res.status(500).json({ error: 'Failed to start jobs' });
    }
});

app.get('/api/channels', (req, res) => {
    try {
        const channels = getSubscriptions();
        res.json({ channels });
    } catch (error) {
        console.error('List channels error:', error);
        res.status(500).json({ error: 'Failed to list channels' });
    }
});

app.post('/api/channels', async (req, res) => {
    const { url } = req.body;
    if (!isValidVideoUrl(url)) {
        return res.status(400).json({ error: 'A valid http(s) URL is required' });
    }

    try {
        const channel = await subscribe(url);
        res.status(201).json({ channel });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

app.get('/api/channels/:id', (req, res) => {
    try {
        const channel = getChannel(req.params.id);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });
        res.json({ channel });
    } catch (error) {
        console.error('Get channel error:', error);
        res.status(500).json({ error: 'Failed to get channel' });
    }
});

app.delete('/api/channels/:id', (req, res) => {
    try {
        const removed = unsubscribe(req.params.id);
        if (!removed) return res.status(404).json({ error: 'Channel not found' });
        res.json({ success: true, message: 'Unsubscribed' });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

app.put('/api/channels/:id', (req, res) => {
    try {
        const allowedFields = ['name', 'avatar'];
        const data = {};
        for (const key of allowedFields) {
            if (key in req.body) {
                data[key] = req.body[key];
            }
        }
        const channel = updateChannel(req.params.id, data);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });
        res.json({ channel });
    } catch (error) {
        console.error('Update channel error:', error);
        res.status(500).json({ error: 'Failed to update channel' });
    }
});

app.post('/api/channels/:id/scrape', async (req, res) => {
    try {
        const types = req.body.types;
        const results = await scrapeChannelVideos(req.params.id, types);
        res.json({ results });
    } catch (error) {
        console.error('Scrape channel error:', error);
        res.status(500).json({ error: error.message || 'Failed to scrape channel' });
    }
});

app.get('/api/files', (req, res) => {
    fs.readdir(downloadsDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to list files' });

        // A file can vanish between readdir and stat (active downloads,
        // concurrent deletes) — skip it instead of crashing the server.
        const fileInfos = files.map(file => {
            try {
                const stats = fs.statSync(path.join(downloadsDir, file));
                return {
                    name: file,
                    size: stats.size,
                    created: stats.birthtime,
                };
            } catch {
                return null;
            }
        }).filter(Boolean).sort((a, b) => b.created - a.created);

        res.json(fileInfos);
    });
});

app.get('/api/files/:filename', (req, res) => {
    const filePath = safeFilePath(req.params.filename);
    if (!filePath) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath);
});

app.delete('/api/files/:filename', (req, res) => {
    const filePath = safeFilePath(req.params.filename);
    if (!filePath) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    try {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'File deleted' });
    } catch (error) {
        console.error('File delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

app.delete('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(downloadsDir);
        let deleted = 0;
        for (const file of files) {
            const filePath = path.join(downloadsDir, file);
            try {
                fs.unlinkSync(filePath);
                deleted++;
            } catch (e) {
                // Skip files that can't be deleted (permissions, etc.)
            }
        }
        res.json({ success: true, deleted });
    } catch (error) {
        console.error('Clear files error:', error);
        res.status(500).json({ error: 'Failed to clear files' });
    }
});

// ======================== OPTIONS ENDPOINTS ========================

// Applies user-saved options, validated against the option catalogue.
// The catalogue itself (YTDLP_OPTIONS) is never mutated by requests.
app.post('/api/options/apply', (req, res) => {
    try {
        const applied = applySavedOptions(req.body?.options);
        res.json({ success: true, applied });
    } catch (error) {
        console.error('Options apply error:', error);
        res.status(400).json({ error: error.message || 'Failed to apply options' });
    }
});

app.post('/api/options/reset', (req, res) => {
    try {
        resetSavedOptions();
        res.json({ success: true });
    } catch (error) {
        console.error('Options reset error:', error);
        res.status(500).json({ error: 'Failed to reset options' });
    }
});

app.get('/api/download/concurrency', (req, res) => {
    try {
        res.json({ concurrency: getConcurrency() });
    } catch (error) {
        console.error('Concurrency get error:', error);
        res.status(500).json({ error: 'Failed to get concurrency' });
    }
});

app.post('/api/download/concurrency', (req, res) => {
    try {
        const { concurrency } = req.body;
        const val = parseInt(concurrency);
        if (isNaN(val) || val < 1 || val > 5) {
            return res.status(400).json({ error: 'Concurrency must be between 1 and 5' });
        }
        setConcurrency(val);
        res.json({ success: true, concurrency: getConcurrency() });
    } catch (error) {
        console.error('Concurrency set error:', error);
        res.status(500).json({ error: 'Failed to set concurrency' });
    }
});


const folderPaths = {
    downloads: downloadsDir,
    bin: BIN_DIR,
};

function openWithSystemHandler(target, cb) {
    // spawn with an argv array — never build a shell string, or crafted
    // filenames become shell command injection.
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    const subprocess = spawn(cmd, [target], { detached: true, stdio: 'ignore' });
    subprocess.on('error', (err) => cb(err));
    subprocess.on('close', (code) => cb(code === 0 ? null : new Error(`Exited with code ${code}`)));
    subprocess.unref();
}

app.post('/api/open-folder', (req, res) => {
    try {
        const { folder } = req.body;
        if (!Object.hasOwn(folderPaths, folder)) return res.status(400).json({ error: 'Unknown folder' });
        const dir = folderPaths[folder];
        if (!dir) return res.status(400).json({ error: 'Unknown folder' });
        if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Folder not found' });
        openWithSystemHandler(dir, (err) => {
            if (err || res.writableEnded) {
                if (err && !res.writableEnded) return res.status(500).json({ error: 'Failed to open folder' });
                return;
            }
            res.json({ success: true });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to open folder' });
    }
});

app.post('/api/open-file/:filename', (req, res) => {
    try {
        const filePath = safeFilePath(req.params.filename);
        if (!filePath) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        // yt-dlp titles control filenames; opening an attacker-named
        // .desktop/.bat/.lnk would let the OS execute it. Only allow media.
        if (!/\.(mp4|mkv|webm|m4v|mp3|m4a|opus|ogg|flac|wav|aac|srt|vtt|jpg|jpeg|png|webp|gif)$/i.test(filePath)) {
            return res.status(400).json({ error: 'Not an openable media file' });
        }
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        openWithSystemHandler(filePath, (err) => {
            if (err || res.writableEnded) {
                if (err && !res.writableEnded) return res.status(500).json({ error: 'Failed to open file' });
                return;
            }
            res.json({ success: true });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to open file' });
    }
});

// SPA fallback for Vue Router - serve index.html for all non-API routes
const indexPath = path.join(__dirname, 'frontend', 'dist', 'index.html');
app.use((req, res, next) => {
    // Skip API routes and asset paths
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
        return next();
    }
    // Only handle GET requests for HTML navigation
    if (req.method !== 'GET') {
        return next();
    }
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        next();
    }
});

// The systemd service passes PORTS=80,4444 so the bare `ytdlp.local` URL
// works (port 80) while the old `:4444` bookmark keeps working too. Binding
// a low port needs net.ipv4.ip_unprivileged_port_start lowered once (README);
// the server skips ports it can't bind instead of dying. A manual `npm start`
// just uses PORT/4444.
const PORTS = (process.env.PORTS || process.env.PORT || 4444)
    .toString()
    .split(',')
    .map((p) => parseInt(p.trim(), 10))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536);
if (PORTS.length === 0) PORTS.push(4444);
// Bind to loopback by default: the API has no authentication, so exposing it
// on all interfaces would hand the LAN an unauthenticated remote-code path.
const HOST = process.env.HOST || '127.0.0.1';
if (process.env.NODE_ENV !== 'test') {
    // Express 5 quirk: the listen callback can fire with address() === null
    // when the bind FAILS (port already taken), so verify the address and
    // treat it as a failed bind.
    // Multi-port tolerance: binding e.g. 80 may fail (no privilege yet) while
    // 4444 works — only exit if NOTHING could bind, so systemd's
    // Restart=on-failure doesn't take the working port down with it.
    let bound = 0;
    let settled = 0;
    let total = PORTS.length;
    if (tlsEnabled) total += 1;
    const maybeFail = () => {
        if (settled === total && bound === 0) {
            console.error(`Failed to bind any of ${HOST}:${PORTS.join(', ')} — is another instance already running?`);
            process.exit(1);
        }
    };
    for (const port of PORTS) {
        const server = app.listen(port, HOST, () => {
            if (!server.address()) {
                // Express 5 quirk: on a failed bind the callback fires with a
                // null address BEFORE the 'error' event — do not count this as
                // settled, the error event below will.
                console.error(`Failed to bind ${HOST}:${port}`);
                setTimeout(maybeFail, 250);
                return;
            }
            settled++;
            bound++;
            console.log(`Server listening on http://${HOST}:${port}`);
            maybeFail();
        });
        server.on('error', (err) => {
            settled++;
            console.error(`Could not bind ${HOST}:${port}: ${err.message}`);
            maybeFail();
        });
    }
    if (tlsEnabled) {
        const tlsServer = https.createServer(tlsOptions, app);
        tlsServer.listen(443, HOST, () => {
            settled++;
            bound++;
            console.log(`Server listening on https://${HOST}:443`);
            maybeFail();
        });
        tlsServer.on('error', (err) => {
            settled++;
            console.error(`Could not bind ${HOST}:443: ${err.message}`);
            maybeFail();
        });
    }
}

// Don't orphan running yt-dlp children when the server goes down.
let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, cancelling downloads and exiting...`);
    try { cancelAll(); } catch {}
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
