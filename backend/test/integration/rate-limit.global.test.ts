import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, testConfig } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';

// A low limit keeps the tests fast; production defaults to 300 requests per minute.
const appWithLimit = (max = 3) => buildTestApp(testConfig({ RATE_LIMIT_MAX: String(max) }));

describe('global rate limit', () => {
  it('answers 429 RATE_LIMITED in the standard error envelope once the limit is spent', async () => {
    const app = appWithLimit();

    for (let n = 1; n <= 3; n++) {
      expect((await request(app).get('/api/auth/me')).status).toBe(401);
    }
    const blocked = await request(app).get('/api/auth/me');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      title: 'Too Many Requests',
    });
    expect(blocked.body.requestId).toBe(blocked.headers['x-request-id']);
    expect(blocked.body.detail).not.toMatch(/failed attempts/i);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('reports the remaining budget in the standard RateLimit headers', async () => {
    const res = await request(appWithLimit()).get('/api/auth/me');

    expect(res.headers['ratelimit']).toMatch(/remaining=2/);
    expect(res.headers['ratelimit-policy']).toMatch(/^3;w=60/);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('limits authenticated routes as well', async () => {
    const { authorization } = await signedInAs('USER');
    const app = appWithLimit(2);

    await request(app).get('/api/vehicles').set('Authorization', authorization);
    await request(app).get('/api/vehicles').set('Authorization', authorization);
    const blocked = await request(app).get('/api/vehicles').set('Authorization', authorization);

    expect(blocked.status).toBe(429);
  });

  it('never limits the liveness and readiness probes', async () => {
    const app = appWithLimit(1);
    const statuses: number[] = [];

    for (let n = 0; n < 5; n++) {
      statuses.push((await request(app).get('/api/health')).status);
      statuses.push((await request(app).get('/api/ready')).status);
    }

    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it('keeps the tighter login limit separate from the global one', async () => {
    const app = buildTestApp(testConfig({ RATE_LIMIT_MAX: '100', AUTH_RATE_LIMIT_MAX: '2' }));
    const wrong = { email: 'nobody@example.com', password: 'not-the-password' };

    await request(app).post('/api/auth/login').send(wrong);
    await request(app).post('/api/auth/login').send(wrong);
    const blocked = await request(app).post('/api/auth/login').send(wrong);

    expect(blocked.status).toBe(429);
    expect(blocked.body.detail).toMatch(/failed attempts/i);
  });
});
