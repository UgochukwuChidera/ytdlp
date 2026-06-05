import express from 'express';
import cors from 'cors';
import ytDlp from 'yt-dlp-exec';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/metadata', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

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
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

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
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const options = {
        noWarnings: true,
        o: '-' // Redirect output to stdout
    };

    let ext = 'mp4';

    if (audioOnly) {
        options.extractAudio = true;
        ext = quality || 'mp3';
        options.audioFormat = ext;
    } else {
        ext = format || 'mp4';
        if (format || quality) {
            // e.g. bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best
            options.f = `${quality || 'bestvideo'}[ext=${ext}]+bestaudio/best[ext=${ext}]/best`;
        } else {
            options.f = 'best';
        }
    }

    try {
        const subprocess = ytDlp.exec(url, options);

        res.setHeader('Content-Disposition', `attachment; filename="download.${ext}"`);
        if (audioOnly) {
            res.setHeader('Content-Type', `audio/${ext === 'mp3' ? 'mpeg' : ext}`);
        } else {
            res.setHeader('Content-Type', `video/${ext}`);
        }

        subprocess.stdout.pipe(res);

        subprocess.stderr.on('data', (data) => {
            console.error(`yt-dlp stderr: ${data}`);
        });

        subprocess.on('error', (err) => {
            console.error('Subprocess error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            }
        });

        req.on('close', () => {
            if (!subprocess.killed) {
                subprocess.kill();
            }
        });

    } catch (error) {
        console.error('Download init error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to initiate download' });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
