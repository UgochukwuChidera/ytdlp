import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { createWriteStream } from 'fs';
import { exec, execSync, execFileSync } from 'child_process';
import os from 'os';
import { BIN_DIR, DATA_DIR, getBinDir, ensureDir } from './paths.js';

export { getBinDir, BIN_DIR };

function getBinaryPath(name) {
    return path.join(BIN_DIR, name);
}

function getBinaryVersion(binPath) {
    try {
        const output = execFileSync(binPath, ['--version'], { encoding: 'utf8', timeout: 10000 });
        return output.trim().split('\n')[0] || 'unknown';
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

function getFfmpegAssetName() {
    const arch = os.arch();
    const platform = os.platform();
    if (platform === 'linux') {
        return arch === 'arm64' ? 'ffmpeg-release-arm64-static.tar.xz' : 'ffmpeg-release-amd64-static.tar.xz';
    }
    if (platform === 'darwin') {
        return arch === 'arm64' ? 'ffmpeg-release-arm64-static.tar.xz' : 'ffmpeg-release-amd64-static.tar.xz';
    }
    if (platform === 'win32') {
        return 'ffmpeg-release-full.7z';
    }
    return 'ffmpeg-release-amd64-static.tar.xz';
}

function getFfmpegBaseUrl() {
    const platform = os.platform();
    if (platform === 'win32') {
        return 'https://www.gyan.dev/ffmpeg/builds';
    }
    return 'https://johnvansickle.com/ffmpeg/releases';
}

function getFfmpegExtractArgs(archivePath) {
    const platform = os.platform();
    if (platform === 'win32') {
        return `"${archivePath}" -o"${BIN_DIR}" ffmpeg.exe ffprobe.exe`;
    }
    return `tar -xf "${archivePath}" --strip-components=1 -C "${BIN_DIR}" --wildcards "*/ffmpeg" "*/ffprobe"`;
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
    ensureDir(BIN_DIR);
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
    const platform = os.platform();
    const baseUrl = getFfmpegBaseUrl();
    const assetName = getFfmpegAssetName();
    const archivePath = path.join(BIN_DIR, assetName);
    const url = `${baseUrl}/${assetName}`;

    await downloadFile(url, archivePath, (p) => onProgress('ffmpeg', p));

    const extractCmd = platform === 'win32'
        ? `tar -xf "${archivePath}" --strip-components=1 -C "${BIN_DIR}" "${assetName.replace('.7z', '')}/bin/ffmpeg.exe" "${assetName.replace('.7z', '')}/bin/ffprobe.exe"`
        : `tar -xf "${archivePath}" --strip-components=1 -C "${BIN_DIR}" --wildcards "*/ffmpeg" "*/ffprobe"`;

    return new Promise((resolve, reject) => {
        exec(extractCmd, (error) => {
            if (error) return reject(error);
            makeExecutable(getBinaryPath('ffmpeg'));
            makeExecutable(getBinaryPath('ffprobe'));
            fs.unlink(archivePath, () => {});
            resolve();
        });
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
    const platform = os.platform();
    const assetName = getFfmpegAssetName();
    const archivePath = path.join(BIN_DIR, assetName);
    if (!fs.existsSync(archivePath)) return;
    
    const extractCmd = platform === 'win32'
        ? `tar -xf "${archivePath}" --strip-components=1 -C "${BIN_DIR}" "${assetName.replace('.7z', '')}/bin/ffmpeg.exe" "${assetName.replace('.7z', '')}/bin/ffprobe.exe"`
        : `tar -xf "${archivePath}" --strip-components=1 -C "${BIN_DIR}" --wildcards "*/ffmpeg" "*/ffprobe"`;

    return new Promise((resolve, reject) => {
        exec(extractCmd, (error) => {
            if (error) return reject(error);
            makeExecutable(getBinaryPath('ffmpeg'));
            makeExecutable(getBinaryPath('ffprobe'));
            fs.unlink(archivePath, () => {});
            resolve();
        });
    });
}
