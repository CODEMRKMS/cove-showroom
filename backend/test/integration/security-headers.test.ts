import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';

describe('security headers (helmet)', () => {
  it('sends the standard hardening headers on API responses', async () => {
    const res = await request(buildTestApp()).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('does not advertise the framework', async () => {
    const res = await request(buildTestApp()).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('puts the headers on error responses too', async () => {
    const res = await request(buildTestApp()).get('/api/nothing-here');

    expect(res.status).toBe(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('keeps Swagger UI working under the default content security policy: no inline scripts', async () => {
    const res = await request(buildTestApp()).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  });
});
