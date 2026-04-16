const request = require('supertest');
const app = require('../src/app');

describe('GET /api/health', () => {
  it('should return status ok with timestamp and uptime', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('GET /', () => {
  it('should return API running message', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toBe('Turnstile Backend API is running');
  });
});
