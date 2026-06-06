import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('yt-dlp-exec', () => {
  const mockFn = jest.fn();
  return { default: mockFn };
});

jest.unstable_mockModule('../src/binary-manager.js', () => {
  const mockCheckBinaries = jest.fn();
  const mockGetBinDir = jest.fn(() => '/tmp/ytdlp-test/bin');
  const mockEnsureBinDir = jest.fn();
  const mockGetLatestYtdlpVersion = jest.fn(() => Promise.resolve('2026.03.17'));
  const mockGetLatestFfmpegVersion = jest.fn(() => Promise.resolve('7.0.2'));
  const mockDownloadBinaries = jest.fn(() => Promise.resolve());
  const mockDownloadFile = jest.fn(() => Promise.resolve());
  const mockExtractFfmpeg = jest.fn(() => Promise.resolve());

  return {
    checkBinaries: mockCheckBinaries,
    getBinDir: mockGetBinDir,
    ensureBinDir: mockEnsureBinDir,
    getLatestYtdlpVersion: mockGetLatestYtdlpVersion,
    getLatestFfmpegVersion: mockGetLatestFfmpegVersion,
    downloadBinaries: mockDownloadBinaries,
    downloadFile: mockDownloadFile,
    extractFfmpeg: mockExtractFfmpeg,
  };
});

jest.unstable_mockModule('../src/download-queue.js', () => {
  const mockAddJob = jest.fn(() => 'mock-job-id-123');
  const mockGetJobs = jest.fn(() => [
    { id: 'job-1', url: 'https://example.com/video', status: 'completed', progress: 100, filename: 'video.mp4', title: 'Test Video', createdAt: Date.now(), options: {} }
  ]);
  const mockGetJob = jest.fn((id) => id === 'job-1' ? { id: 'job-1', url: 'https://example.com/video', status: 'completed', progress: 100 } : null);
  const mockCancelJob = jest.fn((id) => id === 'job-1');
  const mockCancelAll = jest.fn();
  const mockOnProgress = jest.fn(() => () => {});
  const mockGetConcurrency = jest.fn(() => 3);
  const mockSetConcurrency = jest.fn();

  return {
    setConcurrency: mockSetConcurrency,
    getConcurrency: mockGetConcurrency,
    addJob: mockAddJob,
    getJobs: mockGetJobs,
    getJob: mockGetJob,
    cancelJob: mockCancelJob,
    cancelAll: mockCancelAll,
    onProgress: mockOnProgress,
  };
});

jest.unstable_mockModule('../src/channel-manager.js', () => {
  const mockSubscribe = jest.fn(() => Promise.resolve({ id: 'channel-1', url: 'https://youtube.com/@test', name: 'Test Channel' }));
  const mockUnsubscribe = jest.fn((id) => id === 'channel-1');
  const mockGetSubscriptions = jest.fn(() => [
    { id: 'channel-1', url: 'https://youtube.com/@test', name: 'Test Channel', createdAt: Date.now() }
  ]);
  const mockGetChannel = jest.fn((id) => id === 'channel-1' ? { id: 'channel-1', name: 'Test Channel' } : null);
  const mockUpdateChannel = jest.fn((id) => id === 'channel-1' ? { id: 'channel-1', name: 'Updated' } : null);
  const mockScrapeChannelVideos = jest.fn(() => Promise.resolve([{ id: 'vid-1', title: 'Test Video', url: 'https://youtube.com/watch?v=test', type: 'video' }]));

  return {
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    getSubscriptions: mockGetSubscriptions,
    getChannel: mockGetChannel,
    updateChannel: mockUpdateChannel,
    scrapeChannelVideos: mockScrapeChannelVideos,
  };
});

const mod = await Promise.all([
  import('../server.js'),
  import('yt-dlp-exec'),
  import('../src/binary-manager.js'),
  import('../src/download-queue.js'),
  import('../src/channel-manager.js'),
]);

const app = mod[0].default;
const ytDlp = mod[1].default;
const binaryManager = mod[2];
const downloadQueue = mod[3];
const channelManager = mod[4];

beforeEach(() => {
  jest.resetAllMocks();

  binaryManager.checkBinaries.mockReturnValue([
    { name: 'yt-dlp', path: '/tmp/ytdlp-test/bin/yt-dlp', exists: true, version: '2026.03.17' },
    { name: 'ffmpeg', path: '/tmp/ytdlp-test/bin/ffmpeg', exists: true, version: '7.0.2' },
    { name: 'ffprobe', path: '/tmp/ytdlp-test/bin/ffprobe', exists: true, version: '7.0.2' },
  ]);
  binaryManager.getBinDir.mockReturnValue('/tmp/ytdlp-test/bin');

  downloadQueue.getJob.mockImplementation((id) => {
    if (id === 'job-1') return { id: 'job-1', url: 'https://example.com/video', status: 'completed', progress: 100 };
    if (id === 'mock-job-id-123') return { id: 'mock-job-id-123', url: 'https://example.com/video', status: 'queued' };
    return null;
  });
  downloadQueue.cancelJob.mockImplementation((id) => id === 'job-1');
  downloadQueue.getJobs.mockReturnValue([
    { id: 'job-1', url: 'https://example.com/video', status: 'completed', progress: 100, filename: 'video.mp4', title: 'Test Video', createdAt: Date.now(), options: {} }
  ]);
  downloadQueue.addJob.mockReturnValue('mock-job-id-123');
  downloadQueue.getConcurrency.mockReturnValue(3);

  channelManager.unsubscribe.mockImplementation((id) => id === 'channel-1');
  channelManager.updateChannel.mockImplementation((id) => id === 'channel-1' ? { id: 'channel-1', name: 'Updated' } : null);
  channelManager.subscribe.mockResolvedValue({ id: 'channel-1', url: 'https://youtube.com/@test', name: 'Test Channel' });
  channelManager.getSubscriptions.mockReturnValue([
    { id: 'channel-1', url: 'https://youtube.com/@test', name: 'Test Channel', createdAt: Date.now() }
  ]);
  channelManager.getChannel.mockImplementation((id) => id === 'channel-1' ? { id: 'channel-1', name: 'Test Channel' } : null);
  channelManager.scrapeChannelVideos.mockResolvedValue([{ id: 'vid-1', title: 'Test Video', url: 'https://youtube.com/watch?v=test', type: 'video' }]);

  binaryManager.getLatestYtdlpVersion.mockResolvedValue('2026.03.17');
  binaryManager.getLatestFfmpegVersion.mockResolvedValue('7.0.2');
  binaryManager.downloadBinaries.mockResolvedValue();

  ytDlp.mockResolvedValue({ formats: [{ format_id: 'test', ext: 'mp4' }] });
});

describe('API Endpoints', () => {
  describe('GET /api/status', () => {
    it('returns 200 with binary info array', async () => {
      const res = await request(app).get('/api/status').expect(200);
      expect(res.body).toHaveProperty('binaries');
      expect(Array.isArray(res.body.binaries)).toBe(true);
      expect(res.body.binaries[0]).toHaveProperty('name');
      expect(res.body.binaries[0]).toHaveProperty('exists');
    });

    it('returns 200 with queue jobs array', async () => {
      const res = await request(app).get('/api/status').expect(200);
      expect(res.body).toHaveProperty('queue');
      expect(res.body.queue).toHaveProperty('jobs');
      expect(Array.isArray(res.body.queue.jobs)).toBe(true);
    });

    it('returns 200 with concurrency number', async () => {
      const res = await request(app).get('/api/status').expect(200);
      expect(res.body.queue).toHaveProperty('concurrency');
      expect(typeof res.body.queue.concurrency).toBe('number');
      expect(res.body.queue.concurrency).toBe(3);
    });

    it('returns 200 with ytdlpOptions object', async () => {
      const res = await request(app).get('/api/status').expect(200);
      expect(res.body).toHaveProperty('options');
      expect(res.body.options).toHaveProperty('general');
      expect(res.body.options).toHaveProperty('videoSelection');
      expect(res.body.options).toHaveProperty('downloadOptions');
    });
  });

  describe('GET /api/updates', () => {
    it('returns 200 with yt-dlp version info', async () => {
      const res = await request(app).get('/api/updates').expect(200);
      expect(res.body).toHaveProperty('ytDlp');
      expect(res.body.ytDlp).toHaveProperty('latest');
      expect(res.body.ytDlp).toHaveProperty('installed');
      expect(res.body.ytDlp).toHaveProperty('updateAvailable');
    });

    it('returns 200 with ffmpeg version info', async () => {
      const res = await request(app).get('/api/updates').expect(200);
      expect(res.body).toHaveProperty('ffmpeg');
      expect(res.body.ffmpeg).toHaveProperty('latest');
      expect(res.body.ffmpeg).toHaveProperty('installed');
      expect(res.body.ffmpeg).toHaveProperty('updateAvailable');
    });
  });

  describe('GET /api/setup', () => {
    it('returns SSE content type', async () => {
      const res = await request(app).get('/api/setup').expect(200);
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    });

    it('includes binary status in SSE events', async () => {
      const res = await request(app).get('/api/setup').expect(200);
      expect(res.text).toContain('"step":"check"');
      expect(res.text).toContain('"binaries"');
      expect(res.text).toContain('"step":"all"');
      expect(res.text).toContain('"status":"done"');
    });
  });

  describe('POST /api/download/queue', () => {
    it('returns 400 if no URL provided', async () => {
      const res = await request(app)
        .post('/api/download/queue')
        .send({})
        .expect(400);
      expect(res.body).toEqual({ error: 'URL is required' });
    });

    it('returns 201 with job ID when URL provided', async () => {
      const res = await request(app)
        .post('/api/download/queue')
        .send({ url: 'https://example.com/video' })
        .expect(201);
      expect(res.body).toHaveProperty('jobId', 'mock-job-id-123');
      expect(res.body).toHaveProperty('job');
      expect(res.body.job).not.toBeNull();
      expect(downloadQueue.addJob).toHaveBeenCalledWith('https://example.com/video', { url: 'https://example.com/video' });
    });

    it('accepts optional options (format, quality, audioOnly)', async () => {
      const res = await request(app)
        .post('/api/download/queue')
        .send({ url: 'https://example.com/video', format: 'webm', quality: '1080p', audioOnly: true })
        .expect(201);
      expect(res.body).toHaveProperty('jobId');
      expect(downloadQueue.addJob).toHaveBeenCalledWith('https://example.com/video', {
        url: 'https://example.com/video',
        format: 'webm',
        quality: '1080p',
        audioOnly: true,
      });
    });
  });

  describe('GET /api/download/queue', () => {
    it('returns 200 with jobs array', async () => {
      const res = await request(app).get('/api/download/queue').expect(200);
      expect(res.body).toHaveProperty('jobs');
      expect(Array.isArray(res.body.jobs)).toBe(true);
    });

    it('each job has expected properties (id, url, status)', async () => {
      const res = await request(app).get('/api/download/queue').expect(200);
      const job = res.body.jobs[0];
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('status');
    });
  });

  describe('GET /api/download/queue/:id', () => {
    it('returns job when ID exists', async () => {
      const res = await request(app)
        .get('/api/download/queue/job-1')
        .expect(200);
      expect(res.body).toHaveProperty('job');
      expect(res.body.job.id).toBe('job-1');
    });

    it('returns 404 when ID not found', async () => {
      const res = await request(app)
        .get('/api/download/queue/nonexistent')
        .expect(404);
      expect(res.body).toEqual({ error: 'Job not found' });
    });
  });

  describe('DELETE /api/download/queue/:id', () => {
    it('returns 200 with success when cancelling existing job', async () => {
      const res = await request(app)
        .delete('/api/download/queue/job-1')
        .expect(200);
      expect(res.body).toEqual({ success: true, message: 'Job cancelled' });
    });

    it('returns 404 when job not found', async () => {
      const res = await request(app)
        .delete('/api/download/queue/nonexistent')
        .expect(404);
      expect(res.body).toEqual({ error: 'Job not found or already finished' });
    });
  });

  describe('POST /api/download/queue/cancel-all', () => {
    it('returns 200 with success', async () => {
      const res = await request(app)
        .post('/api/download/queue/cancel-all')
        .expect(200);
      expect(res.body).toEqual({ success: true, message: 'All jobs cancelled' });
      expect(downloadQueue.cancelAll).toHaveBeenCalled();
    });
  });

  describe('POST /api/download/queue/batch', () => {
    it('returns 400 if no urls provided', async () => {
      const res = await request(app)
        .post('/api/download/queue/batch')
        .send({})
        .expect(400);
      expect(res.body).toEqual({ error: 'URLs array is required' });
    });

    it('returns 400 if urls is empty array', async () => {
      const res = await request(app)
        .post('/api/download/queue/batch')
        .send({ urls: [] })
        .expect(400);
      expect(res.body).toEqual({ error: 'URLs array is required' });
    });

    it('returns 201 with jobs and count', async () => {
      const res = await request(app)
        .post('/api/download/queue/batch')
        .send({ urls: ['https://example.com/video1', 'https://example.com/video2'], title: 'Batch' })
        .expect(201);
      expect(res.body).toHaveProperty('jobs');
      expect(Array.isArray(res.body.jobs)).toBe(true);
      expect(res.body.jobs).toHaveLength(2);
      expect(res.body).toHaveProperty('count', 2);
      expect(res.body.jobs[0]).toHaveProperty('jobId');
      expect(res.body.jobs[0]).toHaveProperty('url');
      expect(downloadQueue.addJob).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/channels', () => {
    it('returns 200 with channels array', async () => {
      const res = await request(app).get('/api/channels').expect(200);
      expect(res.body).toHaveProperty('channels');
      expect(Array.isArray(res.body.channels)).toBe(true);
    });

    it('each channel has expected properties', async () => {
      const res = await request(app).get('/api/channels').expect(200);
      const channel = res.body.channels[0];
      expect(channel).toHaveProperty('id');
      expect(channel).toHaveProperty('url');
      expect(channel).toHaveProperty('name');
    });
  });

  describe('POST /api/channels', () => {
    it('returns 400 if no URL provided', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({})
        .expect(400);
      expect(res.body).toEqual({ error: 'URL is required' });
    });

    it('returns 201 with channel object', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ url: 'https://youtube.com/@test' })
        .expect(201);
      expect(res.body).toHaveProperty('channel');
      expect(res.body.channel).toHaveProperty('id', 'channel-1');
      expect(res.body.channel).toHaveProperty('name', 'Test Channel');
      expect(channelManager.subscribe).toHaveBeenCalledWith('https://youtube.com/@test');
    });
  });

  describe('DELETE /api/channels/:id', () => {
    it('returns 200 when unsubscribing existing channel', async () => {
      const res = await request(app)
        .delete('/api/channels/channel-1')
        .expect(200);
      expect(res.body).toEqual({ success: true, message: 'Unsubscribed' });
    });

    it('returns 404 when channel not found', async () => {
      const res = await request(app)
        .delete('/api/channels/nonexistent')
        .expect(404);
      expect(res.body).toEqual({ error: 'Channel not found' });
    });
  });

  describe('PUT /api/channels/:id', () => {
    it('returns 200 with updated channel', async () => {
      const res = await request(app)
        .put('/api/channels/channel-1')
        .send({ name: 'Updated' })
        .expect(200);
      expect(res.body).toHaveProperty('channel');
      expect(res.body.channel.name).toBe('Updated');
    });

    it('returns 404 when channel not found', async () => {
      const res = await request(app)
        .put('/api/channels/nonexistent')
        .send({ name: 'Updated' })
        .expect(404);
      expect(res.body).toEqual({ error: 'Channel not found' });
    });
  });

  describe('POST /api/channels/:id/scrape', () => {
    it('returns 200 with scraped videos array', async () => {
      const res = await request(app)
        .post('/api/channels/channel-1/scrape')
        .send({})
        .expect(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results[0]).toHaveProperty('id');
      expect(res.body.results[0]).toHaveProperty('title');
    });

    it('returns 500 when channel not found', async () => {
      channelManager.scrapeChannelVideos.mockRejectedValue(new Error('Channel not found'));

      const res = await request(app)
        .post('/api/channels/nonexistent/scrape')
        .send({})
        .expect(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/options', () => {
    it('returns 200 with options object', async () => {
      const res = await request(app).get('/api/options').expect(200);
      expect(typeof res.body).toBe('object');
    });

    it('has expected category keys', async () => {
      const res = await request(app).get('/api/options').expect(200);
      expect(res.body).toHaveProperty('general');
      expect(res.body).toHaveProperty('videoSelection');
      expect(res.body).toHaveProperty('downloadOptions');
      expect(res.body).toHaveProperty('filesystem');
      expect(res.body).toHaveProperty('thumbnails');
      expect(res.body).toHaveProperty('subtitles');
      expect(res.body).toHaveProperty('postProcessing');
      expect(res.body).toHaveProperty('network');
    });

    it('options within categories have expected properties (flag, type, label)', async () => {
      const res = await request(app).get('/api/options').expect(200);
      const generalOption = res.body.general[0];
      expect(generalOption).toHaveProperty('flag');
      expect(generalOption).toHaveProperty('type');
      expect(generalOption).toHaveProperty('label');
    });
  });

  describe('GET /api/format-list', () => {
    it('returns 400 if no URL provided', async () => {
      const res = await request(app)
        .get('/api/format-list')
        .expect(400);
      expect(res.body).toEqual({ error: 'URL is required' });
    });

    it('returns 200 with format data', async () => {
      const res = await request(app)
        .get('/api/format-list?url=https://example.com')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/metadata', () => {
    it('returns 400 if no URL provided', async () => {
      const res = await request(app)
        .get('/api/metadata')
        .expect(400);
      expect(res.body).toEqual({ error: 'URL is required' });
    });
  });

  describe('GET /api/scrape', () => {
    it('returns 400 if no URL provided', async () => {
      const res = await request(app)
        .get('/api/scrape')
        .expect(400);
      expect(res.body).toEqual({ error: 'URL is required' });
    });
  });

  describe('POST /api/download', () => {
    it('returns 400 if no URL provided', async () => {
      const res = await request(app)
        .post('/api/download')
        .send({})
        .expect(400);
      expect(res.body).toEqual({ error: 'URL is required' });
    });

    it('returns 500 if yt-dlp binary not found', async () => {
      binaryManager.getBinDir.mockReturnValue('/tmp/nonexistent');

      const res = await request(app)
        .post('/api/download')
        .send({ url: 'https://example.com/video' })
        .expect(500);
      expect(res.body).toEqual({ error: 'yt-dlp binary not found. Please run setup first.' });
    });
  });

  describe('GET /api/files', () => {
    it('returns an array', async () => {
      const res = await request(app)
        .get('/api/files')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/files/:filename', () => {
    it('returns 400 for path traversal with ../', async () => {
      const res = await request(app)
        .get('/api/files/..%2F..%2F..%2Fetc%2Fpasswd')
        .expect(400);
      expect(res.body).toEqual({ error: 'Invalid filename' });
    });

    it('returns 400 for filename with slash', async () => {
      const res = await request(app)
        .get('/api/files/some%2Ffile')
        .expect(400);
      expect(res.body).toEqual({ error: 'Invalid filename' });
    });
  });
});
