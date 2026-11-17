# YT-DLP Web Interface

A local web app for [yt-dlp](https://github.com/yt-dlp/yt-dlp): a Node.js + Express backend with a Vue 3 frontend. Paste a URL, pick a quality, and the video lands in `~/Downloads/ytdlp-app` — with a live progress queue, a subscriptions manager for channels, and per-download yt-dlp options.

Everything runs on your machine. No accounts, no cloud, no server bill.

## Features

- **Metadata lookup** — fetch video details (title, thumbnail, duration, uploader) from any supported URL
- **Playlist & channel scraping** — list every video in a playlist or channel and batch-queue them
- **Download queue** — parallel jobs (1–10), live SSE progress, pause/resume/cancel, survives restarts
- **Library** — browse completed files, search, open in the file manager, save to device, delete
- **Subscriptions** — save channels, scrape their latest videos, batch download
- **Options** — fine-tune yt-dlp flags applied to every download
- **System** — one-click install/update of the managed yt-dlp and ffmpeg binaries
- **Local hostnames** — `http://ytdlp.local:4444` via a hosts-file alias

## Prerequisites

- **Node.js** 20+ (ESM)
- **Linux** (optional): `xdg-utils` (xdg-open) or `glib2` (gio) — needed for the "Open file/folder" buttons; `npm run service:install` checks for them

## Setup

```bash
# 1. Clone the repository
git clone <repo-url> && cd ytdlp-app

# 2. Install dependencies and build the frontend
npm run setup

# 3. Start the server
npm start

# 4. Open the app
#    http://localhost:4444
```

On first launch, open **Settings → System** and click **Download all** to fetch the `yt-dlp` and `ffmpeg` binaries into the managed data directory (`~/.local/share/ytdlp-app/bin` on Linux, `~/Library/Application Support/ytdlp-app/bin` on macOS). Downloads won't work until then.

## Run it as a background service (optional)

Starts at login, restarts if it crashes, capped at 512 MB RAM. Idle, it uses roughly 40–60 MB and ~0% CPU; yt-dlp/ffmpeg only run during actual downloads.

```bash
npm run service:install    # Linux: systemd user unit / macOS: launchd agent / Windows: printed instructions
npm run service:status
npm run service:uninstall
```

Linux logs: `journalctl --user -u ytdlp-app -f`

## Local hostname alias (optional)

Make `http://ytdlp.local` resolve to this machine:

```bash
npm run alias:install    # adds a marked block to /etc/hosts (prompts for sudo)
npm run alias:check
npm run alias:remove     # clean removal
```

The alias only affects this machine — browsers on other devices still need `http://<your-ip>:4444`, which is not exposed by default.

## HTTPS (optional)

Get a padlock on `https://ytdlp.local` via a private local CA:

```bash
npm run tls:install    # generates CA + server cert (no sudo needed)
npm run tls:nss        # imports the CA into Firefox/Chrome — close browsers first
```

`tls:install` also prints the one sudo command to trust the CA system-wide
(makes plain `curl` work too). The server detects the certs on restart and
serves `https://…:443`; `http://ytdlp.local` then redirects there. Remove with
`npm run tls:remove`.

## Folders

| What | Where |
|---|---|
| Downloads | `~/Downloads/ytdlp-app` (override: `YTDLP_DOWNLOADS_DIR`) |
| Binaries | `~/.local/share/ytdlp-app/bin` (platform app data dir) |
| Subscriptions/options | same data dir (`channels.json`, saved options) |

## Configuration (env vars)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4444` | HTTP port (manual `npm start`) |
| `PORTS` | `PORT` | Comma-separated ports the service listens on (Linux service: `80,4444`) |
| `HOST` | `127.0.0.1` | Bind address (loopback only — there is no auth) |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,::1,ytdlp.local` | Host-header allowlist (DNS-rebinding guard) |
| `TLS` | enabled if certs exist | Set `0` to disable the 443 listener |
| `TLS_DIR` | `<data dir>/tls` | Where the CA + server cert live |
| `YTDLP_DOWNLOADS_DIR` | `~/Downloads/ytdlp-app` | Download destination |
| `CORS_ORIGIN` | disabled | Cross-origin API access (leave off for local use) |

Binding port 80 (so `http://ytdlp.local` works with no port) needs a one-time
kernel tweak, since regular users can't bind low ports:

```bash
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-ytdlp-app.conf
sudo sysctl --system
systemctl --user restart ytdlp-app   # picks up port 80
```

Until that's done the service simply skips port 80 and stays reachable at
`:4444`.

## Development

```bash
npm start                          # backend on :4444
cd frontend && npm run dev        # Vite dev server on :5173 (proxies /api to :4444)
npm test                          # backend test suite
```

The frontend is built into `frontend/dist` and served statically by the server.

## Security notes

- The server binds to `127.0.0.1` only and has no authentication — it is designed for single-user local use. Don't expose it to your LAN or the internet without adding auth first.
- The queue state lives in memory; restarting the server clears active jobs (files on disk are untouched).
