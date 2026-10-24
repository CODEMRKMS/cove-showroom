import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { createUserWithPassword, signTestToken } from '../helpers/auth.js';

const me = (authorization?: string) => {
  const req = request(buildTestApp()).get('/api/auth/me');
  return authorization === undefined ? req : req.set('Authorization', authorization);
};

describe('GET /api/auth/me: access token verification', () => {
  it('returns the current user for a valid token', async () => {
    const user = await createUserWithPassword({ email: 'gina@example.com', role: 'ADMIN' });

    const res = await me(`Bearer ${signTestToken({ sub: user.id, role: 'ADMIN' })}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.id,
      email: 'gina@example.com',
      name: user.name,
      role: 'ADMIN',
      createdAt: user.createdAt.toISOString(),
    });
  });

  it('takes the role from the database, not from the token', async () => {
    const user = await createUserWithPassword({ role: 'USER' });

    const res = await me(`Bearer ${signTestToken({ sub: user.id, role: 'ADMIN' })}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('USER');
  });

  it.each([
    ['no Authorization header', undefined],
    ['an empty header', ''],
    ['the wrong scheme', 'Basic dXNlcjpwYXNz'],
    ['a Bearer scheme with no token', 'Bearer '],
    ['a token that is not a JWT', 'Bearer not-a-jwt'],
  ])('rejects a request with %s', async (_label, header) => {
    const res = await me(header);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.headers['www-authenticate']).toMatch(/^Bearer/);
  });

  describe('rejects a well-formed token that fails verification', () => {
    const sub = randomUUID();
    const cases: [string, () => string][] = [
      ['expired', () => signTestToken({ sub, expiresIn: -10 })],
      ['signed with a different secret', () => signTestToken({ sub, secret: 'x'.repeat(40) })],
      ['issued for a different audience', () => signTestToken({ sub, audience: 'other-app' })],
      ['issued by a different issuer', () => signTestToken({ sub, issuer: 'someone-else' })],
      [
        'signed with an unexpected algorithm (HS512)',
        () => signTestToken({ sub, algorithm: 'HS512' }),
      ],
      [
        'unsigned (alg none)',
        () => {
          const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
          const now = Math.floor(Date.now() / 1000);
          const payload = { sub, iss: 'cove-api', aud: 'cove-web', iat: now, exp: now + 900 };
          return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
        },
      ],
    ];

    it.each(cases)('%s', async (_label, makeToken) => {
      const res = await me(`Bearer ${makeToken()}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const res = await me(`Bearer ${signTestToken({ sub: randomUUID() })}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});
