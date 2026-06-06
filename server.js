import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import ytDlp from 'yt-dlp-exec';
import {
    checkBinaries,
    getBinDir,
    downloadBinaries,
    getLatestYtdlpVersion,
    getLatestFfmpegVersion,
} from './src/binary-manager.js';
import {
    addJob,
    getJobs,
    getJob,
    cancelJob,
    cancelAll,
    onProgress,
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
const YTDLP_OPTIONS_DEFAULTS = JSON.parse(JSON.stringify(YTDLP_OPTIONS));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadsDir = path.join(__dirname, 'downloads');

const QUALITY_MAP = {
    best: 'bestvideo+bestaudio/best',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
};

const DANGEROUS_FLAGS = ['--exec', '--exec-before-download', '--postprocessor-args', '--ppa', '--external-downloader-args', '--downloader-args'];

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

app.get('/api/status', (req, res) => {
    try {
        const binaries = checkBinaries();
        const jobs = getJobs();
        const concurrency = getConcurrency();

        res.json({
            binaries,
            queue: {
                jobs,
                concurrency,
                active: jobs.filter(j => j.status === 'downloading').length,
                queued: jobs.filter(j => j.status === 'queued').length,
                completed: jobs.filter(j => j.status === 'completed').length,
                failed: jobs.filter(j => j.status === 'failed').length,
            },
            options: YTDLP_OPTIONS,
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

        res.json({
            ytDlp: {
                installed: ytDlpBin?.version || null,
                latest: latestYtdlp,
                updateAvailable: ytDlpBin?.version ? ytDlpBin.version !== latestYtdlp : true,
            },
            ffmpeg: {
                installed: ffmpegBin?.version || null,
                latest: latestFfmpeg,
                updateAvailable: ffmpegBin?.version ? ffmpegBin.version !== latestFfmpeg : true,
            },
        });
    } catch (error) {
        console.error('Update check error:', error);
        res.status(500).json({ error: 'Failed to check for updates' });
    }
});

app.get('/api/setup', async (req, res) => {
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

        await downloadBinaries({
            onProgress: (name, percent) => {
                sendMsg({ step: name, status: 'downloading', percent });
            },
        });

        sendMsg({ step: 'yt-dlp', status: 'done', percent: 100 });
        sendMsg({ step: 'ffmpeg', status: 'done', percent: 100 });
        sendMsg({ step: 'all', status: 'done' });
        res.end();
    } catch (err) {
        console.error('Setup error:', err);
        sendMsg({ step: 'error', error: err.message });
        res.end();
    }
});

app.get('/api/options', (req, res) => {
    res.json(YTDLP_OPTIONS);
});

app.get('/api/format-list', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const data = await ytDlp(url, {
            dumpSingleJson: true,
            noPlaylist: true,
            noWarnings: true,
            noCallHome: true,
        });
        const formats = Array.isArray(data) ? data : (data.formats || []);
        res.json(formats);
    } catch (error) {
        console.error('Format list error:', error);
        res.status(500).json({ error: 'Failed to fetch format list' });
    }
});

app.get('/api/metadata', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const metadata = await ytDlp(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
        });
        res.json(metadata);
    } catch (error) {
        console.error('Metadata fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});

app.get('/api/scrape', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const data = await ytDlp(url, {
            dumpSingleJson: true,
            flatPlaylist: true,
            noWarnings: true,
        });
        res.json(data);
    } catch (error) {
        console.error('Scrape error:', error);
        res.status(500).json({ error: 'Failed to scrape URL' });
    }
});

app.post('/api/download', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const binDir = getBinDir();
        const ytdlpBin = path.join(binDir, 'yt-dlp');
        if (!fs.existsSync(ytdlpBin)) {
            return res.status(500).json({ error: 'yt-dlp binary not found. Please run setup first.' });
        }

        const { format, quality, audioOnly, audioFormat, outputTemplate, extraArgs } = req.body;
        const args = [
            '--no-warnings',
            '--ffmpeg-location', binDir,
            '-P', downloadsDir,
        ];

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

        args.push('--print', 'filename');
        args.push('--no-simulate');
        args.push(url);

        const subprocess = spawn(ytdlpBin, args);
        let filename = '';
        let errData = '';

        subprocess.stdout.on('data', (data) => {
            filename += data.toString();
        });

        subprocess.stderr.on('data', (data) => {
            errData += data.toString();
            console.error(`yt-dlp stderr: ${data}`);
        });

        subprocess.on('close', (code) => {
            if (code === 0) {
                const lines = filename.trim().split('\n');
                const finalFilename = path.basename(lines[lines.length - 1].trim());
                res.json({ success: true, filename: finalFilename });
            } else {
                console.error('yt-dlp exited with code', code);
                res.status(500).json({ error: 'Download failed', details: errData });
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
        res.status(500).json({ error: 'Failed to initiate download' });
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
    if (!url) return res.status(400).json({ error: 'URL is required' });

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
    try {
        const jobs = urls.map(url => {
            const id = addJob(url, {
                url,
                format: req.body.format,
                quality: req.body.quality,
                audioOnly: req.body.audioOnly,
                audioFormat: req.body.audioFormat,
                outputTemplate: req.body.outputTemplate,
                options: req.body.options,
                title: title || url
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
        const cancelled = cancelJob(req.params.id);
        if (!cancelled) return res.status(404).json({ error: 'Job not found or already finished' });
        res.json({ success: true, message: 'Job cancelled' });
    } catch (error) {
        console.error('Queue cancel error:', error);
        res.status(500).json({ error: 'Failed to cancel job' });
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
    if (!url) return res.status(400).json({ error: 'URL is required' });

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

        const fileInfos = files.map(file => {
            const stats = fs.statSync(path.join(downloadsDir, file));
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime,
            };
        }).sort((a, b) => b.created - a.created);

        res.json(fileInfos);
    });
});

app.get('/api/files/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('/') || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(downloadsDir, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath);
});


// ======================== OPTIONS ENDPOINTS ========================

app.post('/api/options/apply', (req, res) => {
    try {
        const { options } = req.body;
        if (options && typeof options === 'object') {
            for (const [key, value] of Object.entries(options)) {
                YTDLP_OPTIONS[key] = value;
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Options apply error:', error);
        res.status(500).json({ error: 'Failed to apply options' });
    }
});

app.post('/api/options/reset', (req, res) => {
    try {
        Object.keys(YTDLP_OPTIONS).forEach(key => delete YTDLP_OPTIONS[key]);
        Object.assign(YTDLP_OPTIONS, JSON.parse(JSON.stringify(YTDLP_OPTIONS_DEFAULTS)));
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


const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

export default app;
