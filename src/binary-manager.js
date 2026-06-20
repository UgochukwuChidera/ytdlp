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

function makeExecutable(filePath) {
    try { fs.chmodSync(filePath, 0o755); } catch {}
}

function getYtdlpAssetName() {
    const arch = os.arch();
    const platform = os.platform();
    if (platform === 'linux') {
        return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
    }
    if (platform === 'darwin') {
        return arch === 'arm64' ? 'yt-dlp_macos_aarch64' : 'yt-dlp_macos';
    }
    if (platform === 'win32') {
        return 'yt-dlp.exe';
    }
    return 'yt-dlp_linux';
}

const PLATFORM_ALIASES = {
    'yt-dlp': {
        linux: ['yt-dlp_linux', 'yt-dlp_linux_aarch64'],
        darwin: ['yt-dlp_macos', 'yt-dlp_macos_aarch64'],
        win32: ['yt-dlp.exe'],
    },
};

export function resolveBinary(name) {
    const exact = getBinaryPath(name);
    if (fs.existsSync(exact)) return exact;
    const aliases = PLATFORM_ALIASES[name];
    if (aliases) {
        const platform = os.platform();
        const candidates = aliases[platform] || [];
        for (const alias of candidates) {
            const aliasPath = getBinaryPath(alias);
            if (fs.existsSync(aliasPath)) return aliasPath;
        }
    }
    return exact;
}

export function checkBinaries() {
    ensureBinDir();
    const binaries = ['yt-dlp', 'ffmpeg', 'ffprobe'];
    return binaries.map((name) => {
        const binPath = resolveBinary(name);
        const exists = fs.existsSync(binPath);
        let version;
        let corrupt = false;
        if (exists) {
            makeExecutable(binPath);
            version = getBinaryVersion(binPath);
            if (!version) {
                corrupt = true;
                version = undefined;
            }
        }
        const info = {
            name,
            path: binPath,
            exists,
            version,
            corrupt,
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
    let existingSize = 0;
    try { existingSize = fs.statSync(dest).size; } catch {}

    return new Promise((resolve, reject) => {
        let aborted = false;
        function doRequest(targetUrl) {
            if (aborted) return;
            const headers = { 'User-Agent': 'ytdlp-app/1.0' };
            if (existingSize > 0) {
                headers['Range'] = `bytes=${existingSize}-`;
            }

            const req = protocol.get(targetUrl, { headers }, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    return doRequest(response.headers.location);
                }

                const isResume = response.statusCode === 206;
                const totalSize = parseInt(response.headers['content-length'], 10);
                const fullSize = isResume
                    ? parseInt((response.headers['content-range'] || '').split('/')[1], 10) || (existingSize + totalSize)
                    : (response.statusCode === 200 ? totalSize : 0);
                let downloaded = existingSize;
                let lastReported = -1;

                const flags = existingSize > 0 && isResume ? 'a' : 'w';
                const file = createWriteStream(dest, { flags });

                response.on('data', (chunk) => {
                    if (aborted) return;
                    downloaded += chunk.length;
                    if (fullSize && onProgress) {
                        const percent = Math.round((downloaded / fullSize) * 100);
                        if (percent !== lastReported) {
                            lastReported = percent;
                            onProgress(percent);
                        }
                    }
                });

                file.on('finish', () => {
                    file.close();
                    if (!aborted) {
                        if (onProgress) onProgress(100);
                        resolve(dest);
                    }
                });

                file.on('error', (err) => {
                    fs.unlink(dest, () => {});
                    reject(err);
                });

                response.pipe(file);
            });

            req.on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });

            return req;
        }
        const req = doRequest(url);
    });
}

export async function downloadYtdlp(onProgress) {
    const ytdlpPath = getBinaryPath('yt-dlp');
    const assetName = getYtdlpAssetName();
    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;
    await downloadFile(url, ytdlpPath, (p) => onProgress('yt-dlp', p));
    makeExecutable(ytdlpPath);
}

export async function downloadFfmpeg(onProgress) {
    const tarPath = path.join(BIN_DIR, 'ffmpeg.tar.xz');
    const url = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
    await downloadFile(url, tarPath, (p) => onProgress('ffmpeg', p));

    return new Promise((resolve, reject) => {
        exec(`tar -xf "${tarPath}" --strip-components=1 -C "${BIN_DIR}" --wildcards "*/ffmpeg" "*/ffprobe"`, (error) => {
            if (error) return reject(error);
            makeExecutable(getBinaryPath('ffmpeg'));
            makeExecutable(getBinaryPath('ffprobe'));
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
            makeExecutable(getBinaryPath('ffmpeg'));
            makeExecutable(getBinaryPath('ffprobe'));
            fs.unlink(tarPath, () => {});
            resolve();
        });
    });
}
