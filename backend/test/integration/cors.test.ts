import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, testConfig } from '../helpers/app.js';

const ALLOWED = 'https://shop.example.com';
const app = () => buildTestApp(testConfig({ CORS_ORIGINS: `${ALLOWED},http://localhost:5173` }));

describe('CORS allow-list', () => {
  it('echoes an allowed origin and allows credentials, so the refresh cookie can travel', async () => {
    const res = await request(app()).get('/api/health').set('Origin', ALLOWED);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers.vary).toMatch(/Origin/);
  });

  it('sends no CORS headers to an origin that is not on the list', async () => {
    const res = await request(app()).get('/api/health').set('Origin', 'https://evil.example.net');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('answers a preflight from an allowed origin with the methods and headers the SPA uses', async () => {
    const res = await request(app())
      .options('/api/vehicles/abc/purchase')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  it('does not grant a preflight to an origin that is not on the list', async () => {
    const res = await request(app())
      .options('/api/vehicles/abc/purchase')
      .set('Origin', 'https://evil.example.net')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('lets requests with no Origin header through (curl, server to server)', async () => {
    const res = await request(app()).get('/api/health');

    expect(res.status).toBe(200);
  });

  it('exposes the request id header so a browser client can quote it', async () => {
    const res = await request(app()).get('/api/health').set('Origin', ALLOWED);

    expect(res.headers['access-control-expose-headers']).toMatch(/X-Request-Id/i);
  });
});
