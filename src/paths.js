import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAppDataDir() {
    const platform = os.platform();
    const home = os.homedir();
    if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'ytdlp-app');
    }
    if (platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'ytdlp-app');
    }
    // Linux and everything else
    return path.join(home, '.local', 'share', 'ytdlp-app');
}

export const DATA_DIR = getAppDataDir();
export const BIN_DIR = path.join(DATA_DIR, 'bin');
// Downloads live next to the OS Downloads folder like a regular app.
export const DOWNLOADS_DIR =
    process.env.YTDLP_DOWNLOADS_DIR || path.join(os.homedir(), 'Downloads', 'ytdlp-app');

export function getBinDir() {
    return BIN_DIR;
}

export function ensureDir(dirPath) {
    return fs.mkdirSync(dirPath, { recursive: true });
}
