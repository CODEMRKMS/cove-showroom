import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { testConfig } from '../helpers/app.js';
import { testPrisma } from '../helpers/db.js';

const CAUSE = 'connect ECONNREFUSED 10.0.0.5:5432 (password authentication for "cove")';

/** The real client, except that a ping to the database fails the way a stopped server would. */
function unreachableDatabase(): PrismaClient {
  return new Proxy(testPrisma(), {
    get: (target, property, receiver) =>
      property === '$queryRaw'
        ? () => Promise.reject(new Error(CAUSE))
        : Reflect.get(target, property, receiver),
  });
}

describe('GET /api/ready', () => {
  it('answers 200 when the database answers, without needing a token', async () => {
    const app = createApp({ config: testConfig(), prisma: testPrisma() });

    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('answers 503 NOT_READY in the standard envelope when the database cannot be reached', async () => {
    const logger = { error: vi.fn() };
    const app = createApp({ config: testConfig(), prisma: unreachableDatabase(), logger });

    const res = await request(app).get('/api/ready');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      code: 'NOT_READY',
    });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('keeps connection details out of the response and in the server log', async () => {
    const logger = { error: vi.fn() };
    const app = createApp({ config: testConfig(), prisma: unreachableDatabase(), logger });

    const res = await request(app).get('/api/ready');

    for (const leak of ['ECONNREFUSED', '10.0.0.5', 'password', 'cove']) {
      expect(res.text).not.toContain(leak);
    }
    expect(logger.error).toHaveBeenCalledTimes(1);
    const { error, requestId } = logger.error.mock.calls[0]![1];
    expect(requestId).toBe(res.body.requestId);
    expect((error as Error).cause).toBeInstanceOf(Error);
    expect(((error as Error).cause as Error).message).toBe(CAUSE);
  });

  it('stays alive when the database is down: /api/health does not touch it', async () => {
    const app = createApp({ config: testConfig(), prisma: unreachableDatabase() });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
