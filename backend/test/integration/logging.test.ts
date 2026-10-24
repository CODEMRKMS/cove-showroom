import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { testConfig } from '../helpers/app.js';
import { TEST_PASSWORD, createUserWithPassword, signedInAs } from '../helpers/auth.js';
import { testPrisma } from '../helpers/db.js';
import { cookieValue } from '../helpers/cookies.js';
import { captureLogs } from '../helpers/log-capture.js';

function appWithLogs(prisma: PrismaClient = testPrisma()) {
  const logs = captureLogs();
  const app = createApp({ config: testConfig(), prisma, log: logs.log });
  return { app, logs };
}

describe('request logging (pino-http)', () => {
  it('writes one structured line per request: method, url, status, duration and the request id', async () => {
    const { app, logs } = appWithLogs();

    const res = await request(app).get('/api/auth/me');

    const [line, ...others] = logs.lines();
    expect(others).toEqual([]);
    expect(line).toMatchObject({
      msg: 'request completed',
      req: { method: 'GET', url: '/api/auth/me' },
      res: { statusCode: 401 },
    });
    expect(line!.responseTime).toEqual(expect.any(Number));
    expect(line!.req.id).toBe(res.headers['x-request-id']);
  });

  it('picks the level from the outcome: info for 2xx, warn for 4xx, error for 5xx', async () => {
    const failing = new Proxy(testPrisma(), {
      get: (target, property, receiver) =>
        property === '$transaction'
          ? () => Promise.reject(new Error('down'))
          : Reflect.get(target, property, receiver),
    });
    const ok = appWithLogs();
    const broken = appWithLogs(failing);
    const { authorization } = await signedInAs('USER');

    await request(ok.app).get('/api/openapi.json');
    await request(ok.app).get('/api/auth/me');
    await request(broken.app).get('/api/vehicles').set('Authorization', authorization);

    expect(ok.logs.lines().map((line) => line.level)).toEqual([30, 40]);
    const access = broken.logs.lines().find((line) => line.msg === 'request completed');
    expect(access).toMatchObject({ level: 50, res: { statusCode: 500 } });
  });

  it('redacts the Authorization and Cookie request headers', async () => {
    const { app, logs } = appWithLogs();

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer header.payload.signature-VISIBLE')
      .set('Cookie', 'refresh_token=cookie-value-VISIBLE');

    expect(logs.raw()).not.toContain('VISIBLE');
    expect(logs.lines()[0]!.req.headers).toMatchObject({
      authorization: '[Redacted]',
      cookie: '[Redacted]',
    });
  });

  it('redacts the refresh token cookie the server sets on login', async () => {
    const { email } = await createUserWithPassword({ email: 'logs@example.com' });
    const { app, logs } = appWithLogs();

    const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });

    const token = cookieValue(res);
    expect(token).toBeTruthy();
    expect(logs.raw()).not.toContain(token);
    expect(logs.lines()[0]!.res.headers['set-cookie']).toBe('[Redacted]');
  });

  it('never writes request bodies, so passwords and tokens in JSON stay out of the log', async () => {
    const { app, logs } = appWithLogs();

    await request(app)
      .post('/api/auth/register')
      .send({ email: 'body@example.com', password: 'a-very-VISIBLE-password-1', name: 'Body' });

    expect(logs.raw()).not.toContain('VISIBLE');
  });

  it('stays quiet for the liveness and readiness probes', async () => {
    const { app, logs } = appWithLogs();

    await request(app).get('/api/health');
    await request(app).get('/api/ready');

    expect(logs.lines()).toEqual([]);
  });

  it('logs an unexpected error with its stack and the request id, while the client sees neither', async () => {
    const SECRET = 'connection refused at db.internal';
    const failing = new Proxy(testPrisma(), {
      get: (target, property, receiver) =>
        property === '$queryRaw'
          ? () => Promise.reject(new Error(SECRET))
          : Reflect.get(target, property, receiver),
    });
    const { app, logs } = appWithLogs(failing);

    const res = await request(app).get('/api/ready');

    expect(res.text).not.toContain('db.internal');
    const failure = logs.lines().find((line) => line.msg === 'Unhandled error' || line.err);
    expect(failure).toBeDefined();
    expect(failure!.err.message).toContain(SECRET);
    expect(failure!.err.stack).toContain('Error');
    expect(failure!.requestId ?? failure!.req?.id).toBe(res.headers['x-request-id']);
  });
});
