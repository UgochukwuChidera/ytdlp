import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { downloadFile, extractFfmpeg } from './setup-utils.js';
import ytDlp from 'yt-dlp-exec';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binDir = path.join(__dirname, 'bin');
const downloadsDir = path.join(__dirname, 'downloads');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure directories exist
if (!fs.existsSync(binDir)) fs.mkdirSync(binDir);
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

app.get('/api/setup', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendMsg = (msg) => {
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
    };

    try {
        sendMsg({ step: 'yt-dlp', status: 'downloading', percent: 0 });
        const ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
        const ytdlpPath = path.join(binDir, 'yt-dlp');
        
        let lastYtdlpPercent = -1;
        await downloadFile(ytdlpUrl, ytdlpPath, (percent) => {
            if (percent !== lastYtdlpPercent) {
                sendMsg({ step: 'yt-dlp', status: 'downloading', percent });
                lastYtdlpPercent = percent;
            }
        });
        fs.chmodSync(ytdlpPath, '755');
        sendMsg({ step: 'yt-dlp', status: 'done', percent: 100 });

        sendMsg({ step: 'ffmpeg', status: 'downloading', percent: 0 });
        const ffmpegUrl = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
        const ffmpegTarPath = path.join(binDir, 'ffmpeg.tar.xz');
        
        let lastFfmpegPercent = -1;
        await downloadFile(ffmpegUrl, ffmpegTarPath, (percent) => {
            if (percent !== lastFfmpegPercent) {
                sendMsg({ step: 'ffmpeg', status: 'downloading', percent });
                lastFfmpegPercent = percent;
            }
        });
        
        sendMsg({ step: 'ffmpeg', status: 'extracting', percent: 100 });
        await extractFfmpeg();
        fs.chmodSync(path.join(binDir, 'ffmpeg'), '755');
        fs.chmodSync(path.join(binDir, 'ffprobe'), '755');
        sendMsg({ step: 'ffmpeg', status: 'done', percent: 100 });

        sendMsg({ step: 'all', status: 'done' });
        res.end();
    } catch (err) {
        console.error(err);
        sendMsg({ step: 'error', error: err.message });
        res.end();
    }
});

// Since the prompt requires us to use the local bin/yt-dlp, let's create a wrapper function for metadata using spawn.
// Wait, yt-dlp-exec uses system installed by default. We can use our local bin/yt-dlp by spawning it manually for metadata too, or just use yt-dlp-exec if it works, but the prompt says:
// "Use child_process to spawn the local bin/yt-dlp binary, passing --ffmpeg-location bin/ if needed, and saving output to downloads/" for download.
// For metadata it's fine to use ytDlp exec since it was there, but it's safer to just use local binary if setup was done. Let's stick to ytDlp for metadata for simplicity unless we see an issue.
// Actually, `yt-dlp-exec` has an `ytDlp.exec` which we could use with local bin? No, yt-dlp-exec uses its own bundled yt-dlp. Let's keep metadata as is, and just use our bin/yt-dlp for downloading.

app.get('/api/metadata', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const metadata = await ytDlp(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificates: true,
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
            noWarnings: true
        });
        res.json(data);
    } catch (error) {
        console.error('Scrape error:', error);
        res.status(500).json({ error: 'Failed to scrape URL' });
    }
});

app.post('/api/download', (req, res) => {
    const { url, format, quality, audioOnly } = req.body;
    
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const ytdlpBin = path.join(binDir, 'yt-dlp');
    if (!fs.existsSync(ytdlpBin)) {
        return res.status(500).json({ error: 'yt-dlp binary not found. Please run setup first.' });
    }

    let ext = 'mp4';
    const args = [
        '--no-warnings',
        '--ffmpeg-location', binDir,
        '-P', downloadsDir
    ];

    if (audioOnly) {
        args.push('--extract-audio');
        ext = quality || 'mp3';
        args.push('--audio-format', ext);
        // Ensure yt-dlp saves with correct extension template
        args.push('-o', `%(title)s.%(ext)s`);
    } else {
        ext = format || 'mp4';
        if (format || quality) {
            args.push('-f', `${quality || 'bestvideo'}[ext=${ext}]+bestaudio/best[ext=${ext}]/best`);
        } else {
            args.push('-f', 'best');
        }
        args.push('-o', `%(title)s.%(ext)s`);
    }

    args.push('--print', 'filename'); // Get the filename printed
    args.push('--no-simulate'); // Ensure download actually happens
    args.push(url);

    try {
        const subprocess = spawn(ytdlpBin, args);
        let filename = '';
        let errData = '';

        subprocess.stdout.on('data', (data) => {
            const out = data.toString();
            // yt-dlp outputs lines. With --print filename, it prints the destination filename.
            // But wait, it might print other things if there are info messages.
            // Let's just collect the last non-empty line as filename.
            filename += out;
        });

        subprocess.stderr.on('data', (data) => {
            errData += data.toString();
            console.error(`yt-dlp stderr: ${data}`);
        });

        subprocess.on('close', (code) => {
            if (code === 0) {
                // Determine the actual filename saved
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

app.get('/api/files', (req, res) => {
    fs.readdir(downloadsDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to list files' });
        
        const fileInfos = files.map(file => {
            const stats = fs.statSync(path.join(downloadsDir, file));
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime
            };
        }).sort((a, b) => b.created - a.created);

        res.json(fileInfos);
    });
});

app.get('/api/files/:filename', (req, res) => {
    const filename = req.params.filename;
    // Basic security to prevent path traversal
    if (filename.includes('/') || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(downloadsDir, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath);
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

export default app;
