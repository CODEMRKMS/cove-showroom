import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, testConfig } from '../helpers/app.js';
import { TEST_PASSWORD, createUserWithPassword } from '../helpers/auth.js';

const wrong = { email: 'frank@example.com', password: 'not-the-password' };
const right = { email: 'frank@example.com', password: TEST_PASSWORD };

// Lowering the limit keeps the tests fast; production uses the default.
const appWithLimit = () => buildTestApp(testConfig({ AUTH_RATE_LIMIT_MAX: '3' }));

describe('POST /api/auth/login: rate limit', () => {
  it('answers 429 RATE_LIMITED after too many failed attempts, even with the right password', async () => {
    await createUserWithPassword({ email: 'frank@example.com' });
    const app = appWithLimit();

    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await request(app).post('/api/auth/login').send(wrong);
      expect(res.status).toBe(401);
    }

    const blocked = await request(app).post('/api/auth/login').send(right);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts only failed attempts, so successful logins never lock anyone out', async () => {
    await createUserWithPassword({ email: 'frank@example.com' });
    const app = appWithLimit();
    const statuses: number[] = [];

    for (const body of [wrong, wrong, right, right, right, wrong, wrong]) {
      statuses.push((await request(app).post('/api/auth/login').send(body)).status);
    }

    expect(statuses).toEqual([401, 401, 200, 200, 200, 401, 429]);
  });
});
