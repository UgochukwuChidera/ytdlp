import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';

// Isolate the persisted queue from the real app data directory.
const QUEUE_FILE = path.join(os.tmpdir(), `ytdlp-queue-test-${process.pid}.json`);
process.env.YTDLP_QUEUE_FILE = QUEUE_FILE;
fs.rmSync(QUEUE_FILE, { force: true });

// A real yt-dlp process would never let us inspect the scheduler, so every
// spawn returns a controllable fake child. This keeps the test about the queue
// itself: how many subprocesses run at once and how slots are refilled.
const spawned = [];
const mockSpawn = jest.fn(() => {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  spawned.push(proc);
  return proc;
});

jest.unstable_mockModule('child_process', () => ({ spawn: mockSpawn }));
jest.unstable_mockModule('../src/binary-manager.js', () => ({
  getBinDir: () => '/fake/bin',
  resolveBinary: () => '/fake/bin/yt-dlp',
}));
jest.unstable_mockModule('../src/paths.js', () => ({
  DOWNLOADS_DIR: '/fake/downloads',
  BIN_DIR: '/fake/bin',
  DATA_DIR: '/fake/data',
  ensureDir: () => {},
}));
jest.unstable_mockModule('../src/saved-options.js', () => ({
  savedOptionsToArgs: () => [],
}));
jest.unstable_mockModule('../src/output-defaults.js', () => ({
  getOutputDefaults: () => ({ videoFormat: 'mp4', audioFormat: 'm4a' }),
  defaultContainer: () => 'mp4',
}));

const {
  addJob,
  clearJobs,
  getConcurrency,
  getJobs,
  setConcurrency,
  shutdownQueue,
} = await import('../src/download-queue.js');

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
};

function finish(proc) {
  proc.emit('close', 0);
}

function readQueueFile() {
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
}

describe('download-queue concurrency', () => {
  beforeEach(() => {
    clearJobs('all');
    spawned.length = 0;
    mockSpawn.mockClear();
    setConcurrency(10);
  });

  afterEach(async () => {
    // Remove jobs first so the close events can't re-spawn them, then drain
    // any fake children so their promises settle.
    clearJobs('all');
    for (const proc of spawned) finish(proc);
    await flush();
  });

  afterAll(() => {
    fs.rmSync(QUEUE_FILE, { force: true });
  });

  it('clamps the configurable ceiling to 10', () => {
    setConcurrency(50);
    expect(getConcurrency()).toBe(10);
    setConcurrency(0);
    expect(getConcurrency()).toBe(5);
    setConcurrency(7);
    expect(getConcurrency()).toBe(7);
  });

  it('applies the saved output defaults to new jobs', async () => {
    addJob('https://example.com/defaults');
    await flush();
    const [job] = getJobs();
    expect(job.options.format).toBe('mp4');
    expect(job.options.audioFormat).toBe('m4a');
  });

  it('honours an explicit auto container over the saved default', async () => {
    addJob('https://example.com/auto', { format: 'auto' });
    await flush();
    const [job] = getJobs();
    expect(job.options.format).toBeUndefined();
  });

  it('spawns up to 10 independent yt-dlp processes at the same time', async () => {
    for (let i = 0; i < 12; i++) addJob(`https://example.com/video/${i}`);
    await flush();

    expect(mockSpawn).toHaveBeenCalledTimes(10);
    const states = getJobs();
    expect(states.filter(j => j.status === 'downloading')).toHaveLength(10);
    expect(states.filter(j => j.status === 'queued')).toHaveLength(2);
  });

  it('refills a freed slot when a running job finishes', async () => {
    for (let i = 0; i < 12; i++) addJob(`https://example.com/video/${i}`);
    await flush();
    expect(mockSpawn).toHaveBeenCalledTimes(10);

    finish(spawned[0]);
    await flush();

    expect(mockSpawn).toHaveBeenCalledTimes(11);
    expect(getJobs().filter(j => j.status === 'downloading')).toHaveLength(10);
  });

  it('persists jobs to disk', async () => {
    addJob('https://example.com/persisted', { title: 'Kept across restarts' });
    await flush();

    const saved = readQueueFile();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      url: 'https://example.com/persisted',
      title: 'Kept across restarts',
    });
    expect(['queued', 'downloading']).toContain(saved[0].status);
    expect(saved[0]._process).toBeUndefined();
  });

  it('shutdown re-queues running jobs instead of deleting them', async () => {
    addJob('https://example.com/interrupted');
    await flush();

    shutdownQueue();

    expect(getJobs()).toHaveLength(1);
    expect(getJobs()[0].status).toBe('queued');
    expect(readQueueFile()[0].status).toBe('queued');
  });
});
