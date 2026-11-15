import fs from 'fs';
import path from 'path';
import https from 'https';
import { createWriteStream } from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import { BIN_DIR, DATA_DIR, getBinDir, ensureDir } from './paths.js';

export { getBinDir, BIN_DIR };

function getBinaryPath(name) {
    return path.join(BIN_DIR, name);
}

function getBinaryVersion(binPath) {
    const name = path.basename(binPath).replace(/\.exe$/i, '').replace(/_linux.*|_macos.*/i, '');
    const isFfBinary = name === 'ffmpeg' || name === 'ffprobe' || name === 'ffplay';
    const versionFlag = isFfBinary ? '-version' : '--version';
    try {
        const output = execFileSync(binPath, [versionFlag], { encoding: 'utf8', timeout: 10000 });
        const firstLine = output.trim().split('\n')[0] || 'unknown';
        if (isFfBinary) {
            // e.g. "ffmpeg version N-125118-gf523577512-20260619 Copyright ..."
            const m = firstLine.match(/version\s+(\S+)/);
            return m ? m[1] : firstLine;
        }
        return firstLine;
    } catch {
        return undefined;
    }
}

function makeExecutable(filePath) {
    try { fs.chmodSync(filePath, 0o755); } catch {}
}

// /api/status polls checkBinaries() frequently; execFileSync version probes
// block the event loop, so cache the result keyed by file mtime+size.
const versionCache = new Map();
function getCachedBinaryVersion(binPath) {
    let stat;
    try {
        stat = fs.statSync(binPath);
    } catch {
        return undefined;
    }
    const key = `${binPath}:${stat.mtimeMs}:${stat.size}`;
    if (versionCache.has(key)) return versionCache.get(key);
    const version = getBinaryVersion(binPath);
    versionCache.set(key, version);
    if (versionCache.size > 32) {
        const firstKey = versionCache.keys().next().value;
        versionCache.delete(firstKey);
    }
    return version;
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
    'ffmpeg': {
        linux: ['ffmpeg'],
        darwin: ['ffmpeg'],
        win32: ['ffmpeg.exe'],
    },
    'ffprobe': {
        linux: ['ffprobe'],
        darwin: ['ffprobe'],
        win32: ['ffprobe.exe'],
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
    ensureDir(DATA_DIR);
    ensureDir(BIN_DIR);
    const binaries = ['yt-dlp', 'ffmpeg', 'ffprobe'];
    return binaries.map((name) => {
        const binPath = resolveBinary(name);
        const exists = fs.existsSync(binPath);
        let version;
        let corrupt = false;
        if (exists) {
            makeExecutable(binPath);
            version = getCachedBinaryVersion(binPath);
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

function getFfmpegAssetName() {
    const platform = os.platform();
    if (platform === 'darwin') {
        return 'ffmpeg-master-latest-macos64-gpl.tar.xz';
    }
    if (platform === 'win32') {
        return 'ffmpeg-master-latest-win64-gpl.zip';
    }
    return 'ffmpeg-master-latest-linux64-gpl.tar.xz';
}

function getFfmpegBaseUrl() {
    return 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest';
}

// tar args as an argv array — never interpolate paths into a shell string.
function getFfmpegExtractArgs(archivePath) {
    const platform = os.platform();
    if (platform === 'win32') {
        return ['-xf', archivePath, '--strip-components=2', '-C', BIN_DIR, '*/bin/ffmpeg.exe', '*/bin/ffprobe.exe'];
    }
    if (platform === 'darwin') {
        // bsdtar matches include patterns as globs by default (no --wildcards flag)
        return ['-xf', archivePath, '--strip-components=2', '-C', BIN_DIR, '*/bin/ffmpeg', '*/bin/ffprobe'];
    }
    // GNU tar needs --wildcards for glob include patterns
    // BtbN archive structure: ffmpeg-master-latest-linux64-gpl/bin/ffmpeg
    return ['-xf', archivePath, '--strip-components=2', '-C', BIN_DIR, '--wildcards', '*/bin/ffmpeg', '*/bin/ffprobe'];
}

export async function getLatestFfmpegVersion() {
    return new Promise((resolve, reject) => {
        https.get('https://api.github.com/repos/yt-dlp/FFmpeg-Builds/releases/latest', {
            headers: { 'User-Agent': 'ytdlp-app/1.0', 'Accept': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const name = json.name || json.tag_name || '';
                    const m = name.match(/(\d{4}-\d{2}-\d{2})/);
                    resolve(m ? m[1] : name);
                } catch {
                    resolve('unknown');
                }
            });
        }).on('error', reject);
    });
}

const MAX_REDIRECTS = 5;
const DOWNLOAD_TIMEOUT_MS = 300000;

// Downloads url to dest atomically: writes to a .part file and renames into
// place only after a complete, non-error response, so a partial or failed
// download can never be mistaken for a working binary.
export async function downloadFile(url, dest, onProgress) {
    ensureDir(BIN_DIR);
    const tmpDest = `${dest}.part`;
    try { fs.unlinkSync(tmpDest); } catch {}

    return new Promise((resolve, reject) => {
        function doRequest(targetUrl, redirectsLeft) {
            const req = https.get(targetUrl, {
                headers: { 'User-Agent': 'ytdlp-app/1.0' },
                timeout: DOWNLOAD_TIMEOUT_MS,
            }, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    response.resume();
                    if (redirectsLeft <= 0) {
                        return reject(new Error('Too many redirects'));
                    }
                    let nextUrl;
                    try {
                        nextUrl = new URL(response.headers.location, targetUrl);
                    } catch {
                        return reject(new Error('Invalid redirect location'));
                    }
                    if (nextUrl.protocol !== 'https:') {
                        return reject(new Error('Refusing non-HTTPS redirect'));
                    }
                    try {
                        return doRequest(nextUrl.toString(), redirectsLeft - 1);
                    } catch (err) {
                        return reject(err);
                    }
                }

                if (response.statusCode !== 200) {
                    response.resume();
                    return reject(new Error(`Download failed with HTTP status ${response.statusCode}`));
                }

                const totalSize = parseInt(response.headers['content-length'], 10);
                const hasTotalSize = Number.isFinite(totalSize) && totalSize > 0;
                let downloaded = 0;
                let lastReported = -1;

                const file = createWriteStream(tmpDest);

                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (hasTotalSize && onProgress) {
                        const percent = Math.round((downloaded / totalSize) * 100);
                        if (percent !== lastReported) {
                            lastReported = percent;
                            onProgress(percent);
                        }
                    }
                });

                response.on('end', () => {
                    file.end();
                });

                file.on('finish', () => {
                    file.close();
                    if (hasTotalSize && downloaded < totalSize) {
                        fs.unlink(tmpDest, () => {});
                        return reject(new Error(`Download incomplete: ${downloaded} of ${totalSize} bytes`));
                    }
                    try {
                        fs.renameSync(tmpDest, dest);
                    } catch (err) {
                        fs.unlink(tmpDest, () => {});
                        return reject(err);
                    }
                    if (onProgress) onProgress(100);
                    resolve(dest);
                });

                file.on('error', (err) => {
                    fs.unlink(tmpDest, () => {});
                    reject(err);
                });

                response.on('error', (err) => {
                    file.destroy();
                    fs.unlink(tmpDest, () => {});
                    reject(err);
                });

                response.pipe(file);
            });

            req.on('timeout', () => {
                req.destroy(new Error('Download timed out'));
            });

            req.on('error', (err) => {
                fs.unlink(tmpDest, () => {});
                reject(err);
            });

            return req;
        }
        doRequest(url, MAX_REDIRECTS);
    });
}

// Single-flight guard: concurrent callers for the same binary share one
// in-flight download instead of racing on the same files.
const inflight = new Map();
function once(key, fn) {
    if (!inflight.has(key)) {
        inflight.set(key, fn().finally(() => inflight.delete(key)));
    }
    return inflight.get(key);
}

export async function downloadYtdlp(onProgress) {
    return once('yt-dlp', async () => {
        const ytdlpPath = getBinaryPath('yt-dlp');
        const assetName = getYtdlpAssetName();
        const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;
        await downloadFile(url, ytdlpPath, (p) => onProgress('yt-dlp', p));
        makeExecutable(ytdlpPath);
    });
}

function extractFfmpegArchive(archivePath) {
    return new Promise((resolve, reject) => {
        try {
            execFileSync('tar', getFfmpegExtractArgs(archivePath), { stdio: 'ignore', timeout: 120000 });
            resolve();
        } catch (error) {
            return reject(error);
        }
    }).then(() => {
        makeExecutable(getBinaryPath('ffmpeg'));
        makeExecutable(getBinaryPath('ffprobe'));
        if (!fs.existsSync(getBinaryPath('ffmpeg')) || !fs.existsSync(getBinaryPath('ffprobe'))) {
            throw new Error('Extraction produced incomplete binaries');
        }
        fs.unlink(archivePath, () => {});
    });
}

export async function downloadFfmpeg(onProgress) {
    return once('ffmpeg', async () => {
        const baseUrl = getFfmpegBaseUrl();
        const assetName = getFfmpegAssetName();
        const archivePath = path.join(BIN_DIR, assetName);
        const url = `${baseUrl}/${assetName}`;

        await downloadFile(url, archivePath, (p) => onProgress('ffmpeg', p));
        await extractFfmpegArchive(archivePath);
    });
}

export async function downloadBinaries(options = {}) {
    ensureDir(BIN_DIR);
    const { onProgress = () => {} } = options;

    await Promise.all([
        downloadYtdlp(onProgress),
        downloadFfmpeg(onProgress),
    ]);
}

export async function extractFfmpeg() {
    const assetName = getFfmpegAssetName();
    const archivePath = path.join(BIN_DIR, assetName);
    if (!fs.existsSync(archivePath)) return;

    await extractFfmpegArchive(archivePath);
}
