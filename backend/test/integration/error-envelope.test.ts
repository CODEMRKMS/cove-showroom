import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { buildTestApp, testConfig } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { testPrisma } from '../helpers/db.js';
import { createVehicle } from '../helpers/factories.js';

const ENVELOPE_KEYS = ['code', 'detail', 'requestId', 'status', 'title', 'type'];
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('error envelope', () => {
  describe('every kind of error answers with the same body shape', () => {
    const cases: [string, () => Promise<request.Response>, number, string, string][] = [
      [
        'validation',
        () => request(buildTestApp()).post('/api/auth/register').send({}),
        400,
        'VALIDATION_ERROR',
        'Bad Request',
      ],
      [
        'missing token',
        () => request(buildTestApp()).get('/api/auth/me'),
        401,
        'UNAUTHENTICATED',
        'Unauthorized',
      ],
      [
        'wrong role',
        async () => {
          const { authorization } = await signedInAs('USER');
          return request(buildTestApp()).post('/api/vehicles').set('Authorization', authorization);
        },
        403,
        'FORBIDDEN',
        'Forbidden',
      ],
      [
        'missing vehicle',
        async () => {
          const { authorization } = await signedInAs('USER');
          return request(buildTestApp())
            .get(`/api/vehicles/${MISSING_ID}`)
            .set('Authorization', authorization);
        },
        404,
        'VEHICLE_NOT_FOUND',
        'Not Found',
      ],
      [
        'out of stock',
        async () => {
          const { id } = await createVehicle({ quantity: 0 });
          const { authorization } = await signedInAs('USER');
          return request(buildTestApp())
            .post(`/api/vehicles/${id}/purchase`)
            .set('Authorization', authorization);
        },
        409,
        'OUT_OF_STOCK',
        'Conflict',
      ],
      [
        'unknown route',
        () => request(buildTestApp()).get('/api/does-not-exist'),
        404,
        'ROUTE_NOT_FOUND',
        'Not Found',
      ],
      [
        'unknown method on a known path',
        () => request(buildTestApp()).patch('/api/vehicles'),
        404,
        'ROUTE_NOT_FOUND',
        'Not Found',
      ],
      [
        'malformed JSON',
        () =>
          request(buildTestApp())
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email": '),
        400,
        'INVALID_JSON',
        'Bad Request',
      ],
      [
        'oversized body',
        () =>
          request(buildTestApp())
            .post('/api/auth/login')
            .send({ email: 'x'.repeat(200_000), password: 'x' }),
        413,
        'PAYLOAD_TOO_LARGE',
        'Payload Too Large',
      ],
      [
        'unsupported charset',
        () =>
          request(buildTestApp())
            .post('/api/auth/login')
            .set('Content-Type', 'application/json; charset=nonsense')
            .send('{}'),
        415,
        'BAD_REQUEST',
        'Unsupported Media Type',
      ],
    ];

    it.each(cases)('%s', async (_name, call, status, code, title) => {
      const res = await call();

      expect(res.status).toBe(status);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      const expectedKeys =
        code === 'VALIDATION_ERROR' ? [...ENVELOPE_KEYS, 'errors'] : ENVELOPE_KEYS;
      expect(Object.keys(res.body).sort()).toEqual(expectedKeys.sort());
      expect(res.body).toMatchObject({ type: 'about:blank', title, status, code });
      expect(res.body.detail).toEqual(expect.any(String));
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });
  });

  describe('request ids', () => {
    it('generates one for every response, successful or not', async () => {
      const ok = await request(buildTestApp()).get('/api/health');
      const failed = await request(buildTestApp()).get('/api/auth/me');

      expect(ok.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(failed.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(ok.headers['x-request-id']).not.toBe(failed.headers['x-request-id']);
    });

    it('keeps a well-formed id sent by the caller, so a request can be traced end to end', async () => {
      const res = await request(buildTestApp())
        .get('/api/auth/me')
        .set('X-Request-Id', 'client-trace_123.abc');

      expect(res.headers['x-request-id']).toBe('client-trace_123.abc');
      expect(res.body.requestId).toBe('client-trace_123.abc');
    });

    it.each([
      ['one with spaces', 'has spaces in it'],
      ['one with markup', '<script>alert(1)</script>'],
      ['one that is too long', 'a'.repeat(65)],
    ])('replaces %s with a generated id', async (_name, sent) => {
      const res = await request(buildTestApp()).get('/api/auth/me').set('X-Request-Id', sent);

      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });
  });

  describe('unexpected failures', () => {
    // The real app on the real database, except that the list query's transaction fails the way a
    // lost connection or a missing table would, with a message that must never reach the client.
    const SECRET = 'relation "Vehicle" does not exist (host=db.internal password=hunter2)';
    function brokenDatabase(): PrismaClient {
      return new Proxy(testPrisma(), {
        get: (target, property, receiver) =>
          property === '$transaction'
            ? () => Promise.reject(new Error(SECRET))
            : Reflect.get(target, property, receiver),
      });
    }

    async function listWithBrokenDatabase(nodeEnv: 'production' | 'development') {
      const logger = { error: vi.fn() };
      const { authorization } = await signedInAs('USER');
      const app = createApp({
        config: testConfig({ NODE_ENV: nodeEnv }),
        prisma: brokenDatabase(),
        logger,
      } as Parameters<typeof createApp>[0]);
      const res = await request(app).get('/api/vehicles').set('Authorization', authorization);
      return { res, logger };
    }

    it.each(['production', 'development'] as const)(
      'answers 500 INTERNAL_ERROR with nothing internal in %s mode',
      async (nodeEnv) => {
        const { res } = await listWithBrokenDatabase(nodeEnv);

        expect(res.status).toBe(500);
        expect(Object.keys(res.body).sort()).toEqual(ENVELOPE_KEYS);
        expect(res.body).toMatchObject({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          code: 'INTERNAL_ERROR',
        });
        expect(res.body.requestId).toBe(res.headers['x-request-id']);
        const raw = res.text;
        for (const leak of [
          'stack',
          'hunter2',
          'relation',
          'db.internal',
          'node_modules',
          ' at ',
        ]) {
          expect(raw).not.toContain(leak);
        }
      },
    );

    it('logs the real error once with the request id, so the response id leads to the cause', async () => {
      const { res, logger } = await listWithBrokenDatabase('production');

      expect(logger.error).toHaveBeenCalledTimes(1);
      const [message, context] = logger.error.mock.calls[0]!;
      expect(message).toEqual(expect.any(String));
      expect(context.requestId).toBe(res.body.requestId);
      expect(context.error).toBeInstanceOf(Error);
      expect(context.error.message).toBe(SECRET);
    });

    it('does not log expected client errors as server errors', async () => {
      const logger = { error: vi.fn() };
      const app = createApp({
        config: testConfig(),
        prisma: testPrisma(),
        logger,
      } as Parameters<typeof createApp>[0]);

      await request(app).get('/api/auth/me');
      await request(app).get('/api/nope');
      await request(app).post('/api/auth/register').send({});

      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
