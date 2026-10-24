import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { TEST_PASSWORD, createUserWithPassword } from '../helpers/auth.js';

async function login(body: Record<string, unknown>) {
  return request(buildTestApp()).post('/api/auth/login').send(body);
}

function withoutRequestId(body: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...body };
  delete copy['requestId'];
  return copy;
}

describe('POST /api/auth/login: failure', () => {
  it('answers 401 INVALID_CREDENTIALS for a wrong password', async () => {
    await createUserWithPassword({ email: 'erin@example.com' });

    const res = await login({ email: 'erin@example.com', password: 'not-the-password' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('gives an unknown email exactly the same response as a wrong password', async () => {
    await createUserWithPassword({ email: 'erin@example.com' });

    const wrongPassword = await login({ email: 'erin@example.com', password: 'not-the-password' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: TEST_PASSWORD });

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    // Everything but the per-request id must be identical.
    expect(withoutRequestId(unknownEmail.body)).toEqual(withoutRequestId(wrongPassword.body));
  });
});
