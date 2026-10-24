import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { TEST_JWT_SECRET, buildTestApp, testConfig } from '../helpers/app.js';
import { TEST_PASSWORD, createUserWithPassword } from '../helpers/auth.js';
import { REFRESH_COOKIE, cookieValue, setCookieLine, sha256Hex } from '../helpers/cookies.js';
import { testPrisma } from '../helpers/db.js';

async function loginAs(app = buildTestApp(), email = 'hana@example.com') {
  await createUserWithPassword({ email });
  return request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
}

describe('refresh token cookie on login', () => {
  it('sets an httpOnly, SameSite=Lax cookie scoped to /api/auth, and stores only its hash', async () => {
    const res = await loginAs();

    const line = setCookieLine(res);
    expect(line).toBeDefined();
    expect(line).toContain('HttpOnly');
    expect(line).toContain('SameSite=Lax');
    expect(line).toContain('Path=/api/auth');
    expect(line).toContain('Max-Age=604800');
    expect(line).not.toContain('Secure'); // only added in production

    const token = cookieValue(res) as string;
    expect(token.length).toBeGreaterThanOrEqual(43);
    const rows = await testPrisma().refreshToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(sha256Hex(token));
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(res.text).not.toContain(token); // never in the body
  });

  it('marks the cookie Secure in production', async () => {
    const res = await loginAs(buildTestApp(testConfig({ NODE_ENV: 'production' })));

    const line = setCookieLine(res);
    expect(line).toBeDefined();
    expect(line).toContain('Secure');
  });
});

describe('POST /api/auth/refresh: rotation', () => {
  it('trades a valid refresh cookie for a new access token and a new refresh cookie', async () => {
    const app = buildTestApp();
    const login = await loginAs(app);
    const oldToken = cookieValue(login) as string;

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${oldToken}`);

    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.expiresIn).toBe(900);
    const claims = jwt.verify(res.body.accessToken, TEST_JWT_SECRET, { algorithms: ['HS256'] });
    expect(claims).toMatchObject({ role: 'USER' });

    const newToken = cookieValue(res) as string;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);

    // The old token is retired and points at its replacement; only the new one is active.
    const oldRow = await testPrisma().refreshToken.findUniqueOrThrow({
      where: { tokenHash: sha256Hex(oldToken) },
    });
    const newRow = await testPrisma().refreshToken.findUniqueOrThrow({
      where: { tokenHash: sha256Hex(newToken) },
    });
    expect(oldRow.revokedAt).not.toBeNull();
    expect(oldRow.replacedById).toBe(newRow.id);
    expect(newRow.revokedAt).toBeNull();
  });

  it('keeps working across several rotations', async () => {
    const app = buildTestApp();
    let token = cookieValue(await loginAs(app)) as string;

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${token}`);
      expect(res.status).toBe(200);
      token = cookieValue(res) as string;
    }
  });
});
