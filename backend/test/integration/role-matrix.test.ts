import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createContainer } from '../../src/container.js';
import { createErrorHandler } from '../../src/middleware/error-handler.js';
import { authorize } from '../../src/middleware/authorize.js';
import { testConfig } from '../helpers/app.js';
import { createUserWithPassword, signTestToken } from '../helpers/auth.js';
import { testPrisma } from '../helpers/db.js';

type Who = 'anonymous' | 'USER' | 'ADMIN';

// The expected access rules, written out independently of the policy map.
// Statuses: what each kind of caller gets from a protected route.
const OPEN = { anonymous: 401, USER: 200, ADMIN: 200 } as const; // any signed-in user
const ADMIN_ONLY = { anonymous: 401, USER: 403, ADMIN: 200 } as const;

const MATRIX = [
  ['GET /api/auth/me', '/api/auth/me', OPEN],
  ['POST /api/vehicles', '/api/vehicles', ADMIN_ONLY],
  ['GET /api/vehicles', '/api/vehicles', OPEN],
  ['GET /api/vehicles/search', '/api/vehicles/search', OPEN],
  ['GET /api/vehicles/:id', '/api/vehicles/42', OPEN],
  ['PUT /api/vehicles/:id', '/api/vehicles/42', ADMIN_ONLY],
  ['DELETE /api/vehicles/:id', '/api/vehicles/42', ADMIN_ONLY],
  ['POST /api/vehicles/:id/purchase', '/api/vehicles/42/purchase', OPEN],
  ['POST /api/vehicles/:id/restock', '/api/vehicles/42/restock', ADMIN_ONLY],
  ['GET /api/orders/mine', '/api/orders/mine', OPEN],
  ['GET /api/admin/events', '/api/admin/events', ADMIN_ONLY],
] as const;

/** An app with one stub handler per protected route, guarded by the real middleware. */
function buildGuardedApp(): Express {
  const { authenticate } = createContainer({ config: testConfig(), prisma: testPrisma() });
  const app = express();
  for (const [key] of MATRIX) {
    const [method, path] = key.split(' ') as [string, string];
    const register = app[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'].bind(app);
    register(path, authenticate, authorize(key), (_req: express.Request, res: express.Response) => {
      res.json({ ok: true });
    });
  }
  app.use(createErrorHandler(console));
  return app;
}

async function callAs(app: Express, who: Who, key: string, concretePath: string) {
  const method = key.split(' ')[0]!.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
  const req = request(app)[method](concretePath);
  if (who === 'anonymous') return req;
  const user = await createUserWithPassword({ role: who });
  return req.set('Authorization', `Bearer ${signTestToken({ sub: user.id })}`);
}

describe('role matrix: every protected route', () => {
  describe.each(MATRIX)('%s', (key, concretePath, expected) => {
    it.each(['anonymous', 'USER', 'ADMIN'] as const)('as %s', async (who) => {
      const res = await callAs(buildGuardedApp(), who, key, concretePath);

      expect(res.status).toBe(expected[who]);
      if (expected[who] === 401) expect(res.body.code).toBe('UNAUTHENTICATED');
      if (expected[who] === 403) expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  it('refuses to guard a route that has no entry in the policy map', () => {
    expect(() => authorize('GET /api/not-in-the-policy' as never)).toThrow(/policy/i);
  });
});
