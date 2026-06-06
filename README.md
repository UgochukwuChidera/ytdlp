# YT-DLP Web Interface

A web-based frontend for [yt-dlp](https://github.com/yt-dlp/yt-dlp) with Node.js + Express backend and Tailwind CSS frontend. Download videos, scrape playlists and channels, manage binaries, and browse your downloads library — all from your browser.

## Features

- **Metadata lookup** — Fetch video details (title, thumbnail, duration, uploader) from any supported URL
- **Playlist & channel scraping** — Scrape all videos in a playlist or channel with flat listing
- **Download with settings** — Choose quality (best/1080p/720p/480p), format (MP4/WebM), or extract audio only (MP3)
- **Live binary setup** — One-click download of yt-dlp and ffmpeg into the local `bin/` directory with progress via Server-Sent Events (SSE)
- **Downloads library** — Browse, list, and download previously saved files
- **Responsive UI** — Tailwind CSS frontend served statically

## Prerequisites

- **Node.js** 20+ (ESM modules)
- **pnpm** — package manager

## Setup

```bash
# 1. Clone the repository
git clone <repo-url> && cd ytdlp-app

# 2. Install dependencies
pnpm install

# 3. Start the server
node server.js

# 4. Open in browser
open http://localhost:3000
```

After starting the server, navigate to the **Setup** tab to download the `yt-dlp` and `ffmpeg` binaries into the `bin/` directory. Downloads are required before using the download functionality.

## Usage

### Download

1. Paste a video, playlist, or channel URL into the input field
2. Click **Fetch Metadata** to inspect a single video, or **Scrape Playlist** to list all videos in a playlist/channel
3. Adjust download settings (quality, format, audio-only)
4. Click the **Download** button on any video card to start the download
5. The file will be saved to the `downloads/` directory and served to your browser

### Setup

The **Setup** page triggers a live binary download via SSE:
1. **yt-dlp** — downloaded from GitHub releases and made executable
2. **ffmpeg / ffprobe** — downloaded from johnvansickle.com, extracted from the tarball
3. Both binaries are placed in `bin/` and used by the download endpoint

### Downloads Library

The **Downloads Library** tab lists all files in the `downloads/` directory, sorted by creation date (newest first), with filename and size. Click any file to download it.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/setup` | SSE stream — downloads yt-dlp and ffmpeg to `bin/` with progress events |
| `GET` | `/api/metadata?url=` | Fetch single video metadata (JSON) |
| `GET` | `/api/scrape?url=` | Scrape playlist/channel entries (JSON) |
| `POST` | `/api/download` | Download a video — body: `{ url, format, quality, audioOnly }` |
| `GET` | `/api/files` | List all files in `downloads/` (JSON array) |
| `GET` | `/api/files/:filename` | Download a specific file from `downloads/` |

### POST `/api/download` request body

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "mp4",
  "quality": "1080p",
  "audioOnly": false
}
```

## Tech Stack

- **Backend** — Node.js, Express 5, yt-dlp-exec (metadata only)
- **Frontend** — HTML, Tailwind CSS (CDN), Font Awesome, vanilla JS
- **Binaries** — Local yt-dlp and ffmpeg in `bin/`, spawned via `child_process`
- **Package manager** — pnpm
- **Module system** — ESM (`"type": "module"`)

## License

[ISC](LICENSE)
