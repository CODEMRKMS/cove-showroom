import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { testPrisma } from '../helpers/db.js';

const valid = {
  email: 'carol@example.com',
  password: 'correct-horse-battery-staple',
  name: 'Carol',
};

async function register(body: Record<string, unknown>) {
  return request(buildTestApp()).post('/api/auth/register').send(body);
}

describe('POST /api/auth/register: validation', () => {
  it.each([
    ['shorter than 10 characters', 'short-pw9'],
    ['a common password', '1234567890'],
    ['a common password in another case', 'PassWord123'],
  ])('rejects a password that is %s', async (_label, password) => {
    const res = await register({ ...valid, password });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toEqual([{ field: 'password', message: expect.any(String) }]);
    expect(await testPrisma().user.count()).toBe(0);
  });

  it.each([
    ['role', { role: 'ADMIN' }],
    ['isAdmin', { isAdmin: true }],
  ])('rejects an unexpected field (%s) instead of ignoring it', async (_label, extra) => {
    const res = await register({ ...valid, ...extra });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await testPrisma().user.count()).toBe(0);
  });

  it('rejects a malformed email and a missing name, reporting each field', async () => {
    const res = await register({ email: 'not-an-email', password: valid.password });

    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: { field: string }) => e.field).sort();
    expect(fields).toEqual(['email', 'name']);
  });
});
