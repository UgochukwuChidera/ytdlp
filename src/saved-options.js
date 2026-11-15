import { YTDLP_OPTIONS } from './ytdlp-options.js';
import { isDangerousFlag } from './ytdlp-args.js';

// Options saved from the Options tab, keyed by raw yt-dlp flag.
// Kept strictly separate from YTDLP_OPTIONS, which is the display catalogue.
const KNOWN_FLAGS = new Set(Object.values(YTDLP_OPTIONS).flat().map(o => o.flag));

// Flags that must never reach the download command line: they change where
// files are written or what yt-dlp prints, which our parsing depends on.
const BLOCKED_FLAGS = new Set(['-o', '-P', '--paths', '-s', '--simulate', '--print', '--dump-json', '--dump-single-json']);

let saved = {};

function validateValue(def, value) {
    if (def.type === 'boolean') return value === true || value === 'true' ? true : null;
    if (def.type === 'number') {
        const n = Number(value);
        return Number.isFinite(n) ? String(n) : null;
    }
    if (def.type === 'choice') return def.choices?.includes(value) ? String(value) : null;
    const s = String(value);
    return s && s.length <= 500 ? s : null;
}

export function applySavedOptions(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new Error('Invalid options payload');
    }
    const applied = [];
    for (const [key, rawValue] of Object.entries(options)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        if (!KNOWN_FLAGS.has(key) || BLOCKED_FLAGS.has(key)) continue;
        const def = Object.values(YTDLP_OPTIONS).flat().find(o => o.flag === key);
        if (!def) continue;
        const value = validateValue(def, rawValue);
        if (value === null) continue;
        saved[key] = value;
        applied.push(key);
    }
    return applied;
}

export function resetSavedOptions() {
    saved = {};
}

export function getSavedOptions() {
    return { ...saved };
}

// Saved options as raw argv for the download command line.
// Defence-in-depth: even though the catalogue is curated, run every flag
// through isDangerousFlag so a future catalogue entry can't bypass the
// extraArgs blocklist.
export function savedOptionsToArgs() {
    const args = [];
    for (const [flag, value] of Object.entries(saved)) {
        if (BLOCKED_FLAGS.has(flag) || isDangerousFlag(flag)) continue;
        if (value === true) {
            args.push(flag);
        } else {
            args.push(flag, String(value));
        }
    }
    return args;
}
