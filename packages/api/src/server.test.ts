import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './server';

describe('API health endpoints', () => {
  it('GET /healthz returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
  });

  it('GET /readyz returns JSON', async () => {
    const res = await request(app).get('/readyz').timeout({ deadline: 4000, response: 4000 });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});


