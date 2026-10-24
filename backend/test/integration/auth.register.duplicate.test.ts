import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { testPrisma } from '../helpers/db.js';

const body = { email: 'bob@example.com', password: 'correct-horse-battery-staple', name: 'Bob' };

describe('POST /api/auth/register: duplicate email', () => {
  it('answers 409 EMAIL_TAKEN, ignoring email case, and keeps the original account', async () => {
    const app = buildTestApp();
    const first = await request(app).post('/api/auth/register').send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/auth/register')
      .send({
        ...body,
        email: 'BOB@Example.com',
        password: 'a-different-long-password',
        name: 'Impostor',
      });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('EMAIL_TAKEN');

    const users = await testPrisma().user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]?.name).toBe('Bob');
  });

  it('lets exactly one of two simultaneous registrations win', async () => {
    const app = buildTestApp();

    const results = await Promise.all([
      request(app).post('/api/auth/register').send(body),
      request(app).post('/api/auth/register').send(body),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await testPrisma().user.count()).toBe(1);
  });
});
