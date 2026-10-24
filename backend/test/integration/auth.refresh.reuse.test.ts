import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { TEST_PASSWORD, createUserWithPassword } from '../helpers/auth.js';
import { REFRESH_COOKIE, cookieValue, sha256Hex } from '../helpers/cookies.js';
import { testPrisma } from '../helpers/db.js';

const app = buildTestApp();

const refreshWith = (token?: string) => {
  const req = request(app).post('/api/auth/refresh');
  return token === undefined ? req : req.set('Cookie', `${REFRESH_COOKIE}=${token}`);
};

async function loginToken(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
  return cookieValue(res) as string;
}

describe('POST /api/auth/refresh: reuse detection', () => {
  it('revokes the whole chain when a retired token is presented again', async () => {
    await createUserWithPassword({ email: 'ivan@example.com' });
    const first = await loginToken('ivan@example.com');
    const second = cookieValue(await refreshWith(first)) as string;
    expect(second).toBeDefined();

    // An attacker (or a stale tab) replays the already-used token.
    const replay = await refreshWith(first);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('UNAUTHENTICATED');

    // The legitimate, newest token is dead too: the user must log in again.
    const afterReplay = await refreshWith(second);
    expect(afterReplay.status).toBe(401);

    const active = await testPrisma().refreshToken.count({ where: { revokedAt: null } });
    expect(active).toBe(0);
  });

  it("does not touch another user's sessions", async () => {
    await createUserWithPassword({ email: 'ivan@example.com' });
    await createUserWithPassword({ email: 'judy@example.com' });
    const ivan = await loginToken('ivan@example.com');
    const judy = await loginToken('judy@example.com');
    await refreshWith(ivan);

    await refreshWith(ivan); // replay

    expect((await refreshWith(judy)).status).toBe(200);
  });
});

describe('POST /api/auth/refresh: invalid tokens', () => {
  it('rejects an expired token and does not rotate it', async () => {
    const user = await createUserWithPassword({ email: 'ivan@example.com' });
    const raw = 'an-expired-token-value-for-the-test-0123456789';
    await testPrisma().refreshToken.create({
      data: { userId: user.id, tokenHash: sha256Hex(raw), expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await refreshWith(raw);

    expect(res.status).toBe(401);
    expect(await testPrisma().refreshToken.count()).toBe(1);
  });

  it.each([
    ['no cookie', undefined],
    ['an unknown token', 'never-issued-by-this-server'],
  ])('rejects %s', async (_label, token) => {
    const res = await refreshWith(token);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});
