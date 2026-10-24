import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { TEST_JWT_SECRET, buildTestApp } from '../helpers/app.js';
import { TEST_PASSWORD, createUserWithPassword } from '../helpers/auth.js';

describe('POST /api/auth/login: success', () => {
  it('returns 200 with a signed access token and the public user', async () => {
    const user = await createUserWithPassword({ email: 'dave@example.com', role: 'ADMIN' });

    const res = await request(buildTestApp())
      .post('/api/auth/login')
      .send({ email: 'Dave@Example.com', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.expiresIn).toBe(900);
    expect(res.body.user).toEqual({
      id: user.id,
      email: 'dave@example.com',
      name: user.name,
      role: 'ADMIN',
      createdAt: user.createdAt.toISOString(),
    });
    expect(res.text).not.toContain('passwordHash');

    const claims = jwt.verify(res.body.accessToken, TEST_JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'cove-api',
      audience: 'cove-web',
    });
    expect(claims).toMatchObject({ sub: user.id, role: 'ADMIN' });
    const { iat, exp } = claims as { iat: number; exp: number };
    expect(exp - iat).toBe(900);
  });
});
