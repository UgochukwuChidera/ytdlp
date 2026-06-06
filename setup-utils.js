import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binDir = path.join(__dirname, 'bin');

export function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return resolve(downloadFile(response.headers.location, dest, onProgress));
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
            }

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloaded = 0;

            const file = fs.createWriteStream(dest);

            response.on('data', (chunk) => {
                downloaded += chunk.length;
                if (totalSize && onProgress) {
                    const percent = Math.round((downloaded / totalSize) * 100);
                    onProgress(percent);
                }
            });

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

export function extractFfmpeg() {
    return new Promise((resolve, reject) => {
        const tarPath = path.join(binDir, 'ffmpeg.tar.xz');
        exec(`tar -xf "${tarPath}" --strip-components=1 -C "${binDir}" --wildcards "*/ffmpeg" "*/ffprobe"`, (error) => {
            if (error) {
                return reject(error);
            }
            fs.unlink(tarPath, () => {});
            resolve();
        });
    });
}
