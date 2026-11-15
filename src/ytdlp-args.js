import path from 'path';

const QUALITY_MAP = {
    best: { pair: 'bestvideo+bestaudio', single: 'best' },
    '2160p': { pair: 'bestvideo[height<=2160]+bestaudio', single: 'best[height<=2160]' },
    '1440p': { pair: 'bestvideo[height<=1440]+bestaudio', single: 'best[height<=1440]' },
    '1080p': { pair: 'bestvideo[height<=1080]+bestaudio', single: 'best[height<=1080]' },
    '720p': { pair: 'bestvideo[height<=720]+bestaudio', single: 'best[height<=720]' },
    '480p': { pair: 'bestvideo[height<=480]+bestaudio', single: 'best[height<=480]' },
    '360p': { pair: 'bestvideo[height<=360]+bestaudio', single: 'best[height<=360]' },
};

// Stream extensions that can be merged into each output container. mkv is a
// merge target only, so its streams keep their native codecs (h264/av1 +
// aac/opus) instead of being constrained.
const CONTAINER_STREAMS = {
    mp4: { video: 'mp4', audio: 'm4a' },
    webm: { video: 'webm', audio: 'webm' },
};

export const DANGEROUS_FLAGS = [
    '--exec',
    '--exec-before-download',
    '--postprocessor-args',
    '--ppa',
    '--external-downloader',
    '--external-downloader-args',
    '--downloader',
    '--downloader-args',
    '--ffmpeg-location',
    '--config-location',
    '--paths',
    '-P',
    '-o',
    '--download-archive',
    '--cookies',
    '--cookies-from-browser',
    '--cache-dir',
    '--force-overwrites',
    '--enable-file-urls',
    '--no-check-certificate',
];

// Single-character shorts that yt-dlp accepts with an ATTACHED value as one
// argv token ("-o/tmp/evil.bin"), which never matches the "df + '='" check.
const DANGEROUS_SHORTS = ['-o', '-P'];

export const ALLOWED_FORMATS = ['mp4', 'webm', 'mkv'];
export const ALLOWED_AUDIO_FORMATS = ['mp3', 'm4a', 'opus', 'flac', 'wav'];
const DEFAULT_OUTPUT_TEMPLATE = '%(title)s.%(ext)s';

export function isValidVideoUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return false;
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

// Output templates must not escape the downloads directory.
export function sanitizeOutputTemplate(tpl) {
    if (typeof tpl !== 'string' || !tpl.trim()) return null;
    if (tpl.includes('/') || tpl.includes('\\') || tpl.includes('..')) return null;
    return tpl;
}

export function isDangerousFlag(flag) {
    if (typeof flag !== 'string') return true;
    if (flag === '--') return true;
    if (DANGEROUS_SHORTS.some(df => flag === df) || /^-[oP]\S/.test(flag)) return true;
    // Attached-value long form ("--paths=/x") is already covered by "df + '='".
    return DANGEROUS_FLAGS.some(df => flag === df || flag.startsWith(df + '='));
}

// extraArgs: array of raw argv strings, or object { flag: true | value }.
// Returns a safe argv list with dangerous flags (and their value args) removed.
export function filterExtraArgs(extraArgs) {
    if (!extraArgs) return [];
    let entries;
    if (Array.isArray(extraArgs)) {
        entries = extraArgs.filter(e => typeof e === 'string');
    } else if (typeof extraArgs === 'object') {
        entries = Object.entries(extraArgs)
            .filter(([k, v]) => typeof k === 'string' && (v === true || (v !== false && v != null)))
            .map(([k, v]) => v === true ? k : [k, String(v)])
            .flat();
    } else {
        return [];
    }
    const filtered = [];
    for (let i = 0; i < entries.length; i++) {
        const flag = entries[i];
        if (isDangerousFlag(flag)) {
            // A bare dangerous flag may be followed by its value argument; skip it too.
            if (typeof entries[i + 1] === 'string' && !entries[i + 1].startsWith('-')) i++;
            continue;
        }
        filtered.push(flag);
    }
    return filtered;
}

export function buildQualityArgs({ format, quality, audioOnly, audioFormat, outputTemplate }, { binDir, downloadsDir, extraArgs = [] }) {
    const args = ['--no-warnings', '--ffmpeg-location', binDir, '-P', downloadsDir];
    const tpl = sanitizeOutputTemplate(outputTemplate) || DEFAULT_OUTPUT_TEMPLATE;
    const container = ALLOWED_FORMATS.includes(format) ? format : null;

    if (audioOnly) {
        args.push('--extract-audio');
        args.push('--audio-format', ALLOWED_AUDIO_FORMATS.includes(audioFormat) ? audioFormat : 'mp3');
    } else if (quality || container) {
        // Always prefer the separate video + audio streams: a constrained
        // pair first (when a container is requested), then the unconstrained
        // best pair, and only then the single progressive file as a last
        // resort. Without this, e.g. mp4 would request bestaudio[ext=mp4]
        // (which does not exist) and silently fall back to a combined stream.
        const { pair, single } = QUALITY_MAP[quality] || QUALITY_MAP.best;
        const streams = container && CONTAINER_STREAMS[container];
        const selectors = [];
        if (streams) {
            selectors.push(
                pair
                    .replaceAll('bestvideo', `bestvideo[ext=${streams.video}]`)
                    .replaceAll('bestaudio', `bestaudio[ext=${streams.audio}]`),
            );
        }
        selectors.push(pair, single);
        args.push('-f', selectors.join('/'));
        if (container) {
            args.push('--merge-output-format', container);
        }
    } else {
        args.push('-f', 'best');
    }
    args.push('-o', tpl);
    args.push(...extraArgs);
    return args;
}

// Extract the final output filename from yt-dlp stdout (--print after_move:filename).
// Progress/status lines like "[download] 100% of ..." are ignored.
export function extractFilename(stdout) {
    const lines = String(stdout).split('\n').map(l => l.trim()).filter(Boolean);
    const candidates = lines.filter(l => !l.startsWith('['));
    const line = candidates.length ? candidates[candidates.length - 1] : '';
    return path.basename(line);
}

// One yt-dlp run usually fetches SEVERAL files in sequence (video-only
// stream, then the audio stream, for a merge). Each file reports its own
// 0-100%, so raw per-file progress would make the bar jump 100 -> 0 mid-job.
// This tracker watches "[download] Destination:" / "has already been
// downloaded" lines to know which file is being fetched and scales progress
// across all of them (monotonic, capped at 99 until the run completes).
//
// Fragmented downloads (HLS/DASH) are trickier: their "[download] x%" lines
// show the CURRENT FRAGMENT's percentage, not the file's — and the percent
// wobbles back and forth because the fragment's total size is only an
// estimate ("of ~795.33KiB"). Those lines carry "(frag N/M)", so the file
// percentage is derived from the fragment position: (N + p/100) / (M + 1).
export function createProgressTracker(job, expectedFiles) {
    let seenFiles = 0;
    let currentFile = 0;
    return (text) => {
        const destCount =
            (text.match(/\[download\]\s+Destination:/g) || []).length +
            (text.match(/\[download\]\s+.* has already been downloaded/g) || []).length;
        if (destCount) {
            seenFiles += destCount;
            currentFile = Math.max(0, seenFiles - 1);
            job.fileIndex = Math.min(currentFile + 1, expectedFiles);
        }

        let filePct = null;
        const fragMatches = [...text.matchAll(/\[download\]\s+(\d+\.?\d*)%.*?\(frag\s+(\d+)\/(\d+)\)/g)];
        if (fragMatches.length) {
            const m = fragMatches[fragMatches.length - 1];
            const n = parseInt(m[2], 10);
            const total = parseInt(m[3], 10) + 1;
            filePct = ((n + parseFloat(m[1]) / 100) / total) * 100;
        } else {
            const matches = [...text.matchAll(/\[download\]\s+(\d+\.?\d*)%/g)];
            if (matches.length) {
                filePct = parseFloat(matches[matches.length - 1][1]);
            }
        }

        const overall = Math.min(
            99,
            Math.floor(((currentFile + (filePct ?? 0) / 100) / expectedFiles) * 100),
        );
        if (overall > job.progress) {
            job.progress = overall;
            return true;
        }
        if (destCount) {
            return true;
        }
        return false;
    };
}
