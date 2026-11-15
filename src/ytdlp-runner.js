import { spawn } from 'child_process';
import { resolveBinary } from './binary-manager.js';
import { isValidVideoUrl } from './ytdlp-args.js';

const DUMP_TIMEOUT_MS = 90000;
const MAX_STDOUT_BYTES = 64 * 1024 * 1024;

// Runs the managed yt-dlp binary (downloaded into BIN_DIR) and parses its
// --dump-single-json output. All URLs must be http(s) and are passed after a
// `--` separator so they can never be interpreted as yt-dlp flags.
export function dumpJson(url, flags = []) {
    if (!isValidVideoUrl(url)) {
        return Promise.reject(new Error('Invalid URL'));
    }
    const bin = resolveBinary('yt-dlp');
    const args = ['--dump-single-json', '--no-warnings', ...flags, '--', url];

    return new Promise((resolve, reject) => {
        const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let settled = false;
        let stdoutBytes = 0;

        const timer = setTimeout(() => {
            settled = true;
            try { proc.kill('SIGKILL'); } catch {}
            reject(new Error('yt-dlp timed out'));
        }, DUMP_TIMEOUT_MS);
        if (typeof timer.unref === 'function') timer.unref();

        proc.stdout.on('data', (d) => {
            stdoutBytes += d.length;
            if (stdoutBytes > MAX_STDOUT_BYTES) {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    try { proc.kill('SIGKILL'); } catch {}
                    reject(new Error('yt-dlp output too large'));
                }
                return;
            }
            stdout += d.toString();
        });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('error', (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
        proc.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code !== 0) {
                const msg = stderr.trim().split('\n').filter(Boolean).pop();
                reject(new Error(msg || `yt-dlp exited with code ${code}`));
                return;
            }
            try {
                resolve(JSON.parse(stdout));
            } catch (err) {
                reject(new Error(`Failed to parse yt-dlp output: ${err.message}`));
            }
        });
    });
}
