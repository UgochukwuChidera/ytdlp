import { createProgressTracker, extractFilename, filterExtraArgs, sanitizeOutputTemplate, isValidVideoUrl } from '../src/ytdlp-args.js';

describe('createProgressTracker', () => {
  it('scales progress across a video + audio file merge without going backwards', () => {
    const job = { progress: 0 };
    const track = createProgressTracker(job, 2);

    track('[download] Destination: video.f400.mp4');
    track('[download]  50.0% of  61.00MiB');
    track('[download]  99.5% of  61.00MiB');
    track('[download] 100% of  61.00MiB in 00:10');
    expect(job.progress).toBe(50);

    track('[download] Destination: audio.f616.m4a');
    expect(job.fileIndex).toBe(2);
    track('[download]  50.0% of   3.00MiB');
    track('[download] 100% of   3.00MiB in 00:01');
    expect(job.progress).toBe(99);
  });

  it('never lets progress decrease within a file', () => {
    const job = { progress: 0 };
    const track = createProgressTracker(job, 1);
    track('[download] Destination: video.mp4');
    track('[download]  30.0% of  10.00MiB');
    track('[download]  10.0% of  10.00MiB');
    track('[download]  60.0% of  10.00MiB');
    expect(job.progress).toBe(60);
  });

  it('derives smooth file progress from fragmented (HLS/DASH) output', () => {
    // Real captured yt-dlp output: per-fragment percentage wobbles because
    // the fragment size is an estimate.
    const job = { progress: 0 };
    const track = createProgressTracker(job, 1);
    track('[download] Destination: audio.m4a');
    const feed = (t) => track(t);

    feed('[download] 100.0% of ~   1.00KiB at    1.02KiB/s ETA Unknown (frag 0/3)');
    feed('[download]  77.8% of ~   9.00KiB at    6.64KiB/s ETA Unknown (frag 0/3)');
    feed('[download]  67.2% of ~ 189.00KiB at   50.29KiB/s ETA 00:00 (frag 0/3)');
    feed('[download]  16.7% of ~ 795.33KiB at   50.29KiB/s ETA 00:00 (frag 1/3)');
    feed('[download]  67.7% of ~ 200.33KiB at   58.47KiB/s ETA 00:00 (frag 1/3)');
    feed('[download]  70.9% of ~ 656.53KiB at   95.36KiB/s ETA 00:00 (frag 3/3)');
    feed('[download] 100% of  465.23KiB in 00:00:05 at 91.69KiB/s');

    // Fragment wobble must be smoothed into a monotonic ramp
    expect(job.progress).toBe(99);
  });

  it('counts already-downloaded files on resume', () => {
    const job = { progress: 0 };
    const track = createProgressTracker(job, 2);
    track('[download] video.f400.mp4 has already been downloaded');
    track('[download] Destination: audio.f616.m4a');
    track('[download]  80.0% of   3.00MiB');
    expect(job.progress).toBe(90);
    expect(job.fileIndex).toBe(2);
  });
});

describe('extractFilename', () => {
  it('returns the last non-status line, ignoring progress noise', () => {
    const stdout = [
      '[download]  50.0% of  1.00MiB',
      '[download] 100% of  1.00MiB in 00:00:05',
      'downloads/Me at the zoo.mp4',
    ].join('\n');
    expect(extractFilename(stdout)).toBe('Me at the zoo.mp4');
  });
});

describe('filterExtraArgs', () => {
  it('strips dangerous flags including their value arguments', () => {
    expect(filterExtraArgs(['--exec', 'rm -rf /', '-o', 'evil', '--ppa', 'x', '--verbose']))
      .toEqual(['--verbose']);
    expect(filterExtraArgs(['--exec=sh -c evil'])).toEqual([]);
  });

  it('keeps safe flags and values', () => {
    expect(filterExtraArgs(['--limit-rate', '50K', '--write-subs'])).toEqual(['--limit-rate', '50K', '--write-subs']);
  });

  it('strips attached-value short flags like -oVALUE and -Pdir', () => {
    expect(filterExtraArgs(['-o/tmp/evil.bin', '--force-overwrites'])).toEqual([]);
    expect(filterExtraArgs(['-P/tmp'])).toEqual([]);
  });

  it('strips newly blacklisted exec/write/proxy pivots', () => {
    expect(filterExtraArgs([
      '--ffmpeg-location', '/evil',
      '--external-downloader', 'curl',
      '--downloader', 'curl',
      '--download-archive', '/tmp/x.txt',
      '--cookies', '/etc/passwd',
      '--cache-dir', '/tmp',
    ])).toEqual([]);
  });

  it('drops bare -- so it cannot terminate our own option parsing', () => {
    expect(filterExtraArgs(['--'])).toEqual([]);
    expect(filterExtraArgs(['--', '--version'])).toEqual(['--version']);
  });

  it('drops false/null object values instead of emitting "--flag false"', () => {
    expect(filterExtraArgs({ '--no-playlist': false, '--write-subs': true, '--limit-rate': '50K' }))
      .toEqual(['--write-subs', '--limit-rate', '50K']);
  });
});

describe('sanitizeOutputTemplate', () => {
  it('rejects traversal and path separators', () => {
    expect(sanitizeOutputTemplate('../../.ssh/evil')).toBeNull();
    expect(sanitizeOutputTemplate('sub/dir/%(title)s')).toBeNull();
    expect(sanitizeOutputTemplate('back\\slash')).toBeNull();
    expect(sanitizeOutputTemplate('%(title)s.%(ext)s')).toBe('%(title)s.%(ext)s');
  });
});

describe('isValidVideoUrl', () => {
  it('accepts only http(s) URLs', () => {
    expect(isValidVideoUrl('https://example.com/v')).toBe(true);
    expect(isValidVideoUrl('http://example.com/v')).toBe(true);
    expect(isValidVideoUrl('--exec=evil')).toBe(false);
    expect(isValidVideoUrl('file:///etc/passwd')).toBe(false);
    expect(isValidVideoUrl('not a url')).toBe(false);
    expect(isValidVideoUrl('')).toBe(false);
  });
});
