import request from 'supertest';
import app from '../server.js';

describe('API Endpoints', () => {
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
