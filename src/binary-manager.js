import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { execSync, exec } from 'child_process';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DATA_DIR = path.join(os.homedir(), '.local', 'share', 'ytdlp-app');
const BIN_DIR = path.join(DATA_DIR, 'bin');
const OLD_BIN_DIR = path.join(projectRoot, 'bin');

export function getBinDir() {
    return BIN_DIR;
}

export function ensureBinDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
    }
    migrateOldBinaries();
}

function migrateOldBinaries() {
    if (!fs.existsSync(OLD_BIN_DIR)) return;
    const entries = fs.readdirSync(OLD_BIN_DIR);
    for (const entry of entries) {
        const oldPath = path.join(OLD_BIN_DIR, entry);
        const newPath = path.join(BIN_DIR, entry);
        if (!fs.existsSync(newPath)) {
            try {
                fs.cpSync(oldPath, newPath, { recursive: true, dereference: true });
            } catch {
                try {
                    fs.copyFileSync(oldPath, newPath);
                } catch {
                    // skip on failure
                }
            }
        }
    }
}

function getBinaryPath(name) {
    return path.join(BIN_DIR, name);
}

function getBinaryVersion(binPath) {
    try {
        const output = execSync(`"${binPath}" --version 2>/dev/null`).toString().trim();
        return output.split('\n')[0] || 'unknown';
    } catch {
        return undefined;
    }
}

export function checkBinaries() {
    ensureBinDir();
    const binaries = ['yt-dlp', 'ffmpeg', 'ffprobe'];
    return binaries.map((name) => {
        const binPath = getBinaryPath(name);
        const exists = fs.existsSync(binPath);
        const info = {
            name,
            path: binPath,
            exists,
            version: exists ? getBinaryVersion(binPath) : undefined,
        };
        return info;
    });
}

export async function getLatestYtdlpVersion() {
    return new Promise((resolve, reject) => {
        https.get('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
            headers: { 'User-Agent': 'ytdlp-app/1.0', 'Accept': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.tag_name || json.name || 'unknown');
                } catch {
                    resolve('unknown');
                }
            });
        }).on('error', reject);
    });
}

export async function getLatestFfmpegVersion() {
    return new Promise((resolve, reject) => {
        https.get('https://johnvansickle.com/ffmpeg/', {
            headers: { 'User-Agent': 'ytdlp-app/1.0' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const match = data.match(/ffmpeg-(\d+\.\d+(?:\.\d+)?)/);
                resolve(match ? match[1] : 'unknown');
            });
        }).on('error', reject);
    });
}

export async function downloadFile(url, dest, onProgress) {
    ensureBinDir();
    const protocol = url.startsWith('https') ? https : http;

    return new Promise((resolve, reject) => {
        function doRequest(targetUrl) {
            protocol.get(targetUrl, {
                headers: { 'User-Agent': 'ytdlp-app/1.0' },
            }, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    return doRequest(response.headers.location);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                }

                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloaded = 0;
                let lastReported = -1;

                const file = createWriteStream(dest);

                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (totalSize && onProgress) {
                        const percent = Math.round((downloaded / totalSize) * 100);
                        if (percent !== lastReported) {
                            lastReported = percent;
                            onProgress(percent);
                        }
                    }
                });

                file.on('finish', () => {
                    file.close();
                    if (onProgress) onProgress(100);
                    resolve(dest);
                });

                file.on('error', (err) => {
                    fs.unlink(dest, () => {});
                    reject(err);
                });

                response.pipe(file);
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        }
        doRequest(url);
    });
}

async function downloadYtdlp(onProgress) {
    const ytdlpPath = getBinaryPath('yt-dlp');
    const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
    await downloadFile(url, ytdlpPath, (p) => onProgress('yt-dlp', p));
    fs.chmodSync(ytdlpPath, 0o755);
}

async function downloadFfmpeg(onProgress) {
    const tarPath = path.join(BIN_DIR, 'ffmpeg.tar.xz');
    const url = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
    await downloadFile(url, tarPath, (p) => onProgress('ffmpeg', p));

    return new Promise((resolve, reject) => {
        exec(`tar -xf "${tarPath}" --strip-components=1 -C "${BIN_DIR}" --wildcards "*/ffmpeg" "*/ffprobe"`, (error) => {
            if (error) return reject(error);
            try {
                fs.chmodSync(getBinaryPath('ffmpeg'), 0o755);
                fs.chmodSync(getBinaryPath('ffprobe'), 0o755);
            } catch {}
            fs.unlink(tarPath, () => {});
            resolve();
        });
    });
}

export async function downloadBinaries(options = {}) {
    ensureBinDir();
    const { onProgress = () => {} } = options;

    await Promise.all([
        downloadYtdlp(onProgress),
        downloadFfmpeg(onProgress),
    ]);
}

export async function extractFfmpeg() {
    const tarPath = path.join(BIN_DIR, 'ffmpeg.tar.xz');
    if (!fs.existsSync(tarPath)) return;
    return new Promise((resolve, reject) => {
        exec(`tar -xf "${tarPath}" --strip-components=1 -C "${BIN_DIR}" --wildcards "*/ffmpeg" "*/ffprobe"`, (error) => {
            if (error) return reject(error);
            try {
                fs.chmodSync(getBinaryPath('ffmpeg'), 0o755);
                fs.chmodSync(getBinaryPath('ffprobe'), 0o755);
            } catch {}
            fs.unlink(tarPath, () => {});
            resolve();
        });
    });
}
