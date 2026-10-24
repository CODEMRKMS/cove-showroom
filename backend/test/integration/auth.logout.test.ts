import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { TEST_PASSWORD, createUserWithPassword } from '../helpers/auth.js';
import { REFRESH_COOKIE, cookieValue, setCookieLine, sha256Hex } from '../helpers/cookies.js';
import { testPrisma } from '../helpers/db.js';

const app = buildTestApp();
const withCookie = (token: string) => `${REFRESH_COOKIE}=${token}`;

const login = async (email = 'kate@example.com') =>
  cookieValue(
    await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD }),
  ) as string;

const refresh = (token: string) =>
  request(app).post('/api/auth/refresh').set('Cookie', withCookie(token));

const logout = (token?: string) => {
  const req = request(app).post('/api/auth/logout');
  return token === undefined ? req : req.set('Cookie', withCookie(token));
};

describe('POST /api/auth/logout', () => {
  it('answers 204, clears the cookie and revokes the token', async () => {
    await createUserWithPassword({ email: 'kate@example.com' });
    const token = await login();

    const res = await logout(token);

    expect(res.status).toBe(204);
    const line = setCookieLine(res);
    expect(line).toContain(`${REFRESH_COOKIE}=;`);
    expect(line).toContain('Path=/api/auth');
    expect(line).toContain('Expires=Thu, 01 Jan 1970');

    const row = await testPrisma().refreshToken.findUniqueOrThrow({
      where: { tokenHash: sha256Hex(token) },
    });
    expect(row.revokedAt).not.toBeNull();
    expect((await refresh(token)).status).toBe(401);
  });

  it('revokes the rest of the chain when called with an already-rotated token', async () => {
    await createUserWithPassword({ email: 'kate@example.com' });
    const stale = await login();
    const current = cookieValue(await refresh(stale)) as string;

    expect((await logout(stale)).status).toBe(204);

    expect((await refresh(current)).status).toBe(401);
  });

  it("leaves the user's other sessions signed in", async () => {
    await createUserWithPassword({ email: 'kate@example.com' });
    const laptop = await login();
    const phone = await login();

    await logout(laptop);

    expect((await refresh(phone)).status).toBe(200);
  });

  it.each([
    ['no cookie', undefined],
    ['an unknown token', 'never-issued-by-this-server'],
  ])('is idempotent: %s still answers 204 and clears the cookie', async (_label, token) => {
    const res = await logout(token);

    expect(res.status).toBe(204);
    expect(setCookieLine(res)).toContain(`${REFRESH_COOKIE}=;`);
  });
});
