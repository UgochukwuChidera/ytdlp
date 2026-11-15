import fs from 'fs';
import path from 'path';
import { DATA_DIR, ensureDir } from './paths.js';
import { ALLOWED_FORMATS, ALLOWED_AUDIO_FORMATS } from './ytdlp-args.js';

// User-configurable defaults for new downloads. Persisted next to the binaries
// so a restart (or the systemd service) keeps the user's preference.
const FILE = path.join(DATA_DIR, 'output-defaults.json');

export const VIDEO_CHOICES = ['auto', ...ALLOWED_FORMATS];
export const AUDIO_CHOICES = [...ALLOWED_AUDIO_FORMATS];

const FALLBACK = Object.freeze({
    // 'auto' lets yt-dlp pick the best pair with no container constraint.
    videoFormat: 'mp4',
    audioFormat: 'm4a',
});

function sanitize(value) {
    const out = { ...FALLBACK };
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (VIDEO_CHOICES.includes(value.videoFormat)) out.videoFormat = value.videoFormat;
        if (AUDIO_CHOICES.includes(value.audioFormat)) out.audioFormat = value.audioFormat;
    }
    return out;
}

function load() {
    try {
        return sanitize(JSON.parse(fs.readFileSync(FILE, 'utf8')));
    } catch {
        return { ...FALLBACK };
    }
}

let current = load();

export function getOutputDefaults() {
    return { ...current };
}

export function setOutputDefaults(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('Invalid output defaults payload');
    }
    const next = { ...current };
    if ('videoFormat' in patch) {
        if (!VIDEO_CHOICES.includes(patch.videoFormat)) {
            throw new Error(`videoFormat must be one of: ${VIDEO_CHOICES.join(', ')}`);
        }
        next.videoFormat = patch.videoFormat;
    }
    if ('audioFormat' in patch) {
        if (!AUDIO_CHOICES.includes(patch.audioFormat)) {
            throw new Error(`audioFormat must be one of: ${AUDIO_CHOICES.join(', ')}`);
        }
        next.audioFormat = patch.audioFormat;
    }
    current = next;
    try {
        ensureDir(DATA_DIR);
        const tmp = `${FILE}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(current, null, 2));
        fs.renameSync(tmp, FILE);
    } catch (err) {
        console.error('Failed to persist output defaults:', err);
    }
    return getOutputDefaults();
}

// The container used when a job did not ask for one explicitly. 'auto' means
// "no --merge-output-format / stream constraints".
export function defaultContainer() {
    return current.videoFormat === 'auto' ? undefined : current.videoFormat;
}
