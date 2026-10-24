import argon2 from 'argon2';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { testPrisma } from '../helpers/db.js';

const validBody = {
  email: 'Alice@Example.com',
  password: 'correct-horse-battery-staple',
  name: 'Alice',
};

describe('POST /api/auth/register: success', () => {
  it('creates a USER and returns 201 with the public user fields', async () => {
    const res = await request(buildTestApp()).post('/api/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      email: 'alice@example.com', // normalised to lowercase
      name: 'Alice',
      role: 'USER',
      createdAt: expect.any(String),
    });

    const stored = await testPrisma().user.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.role).toBe('USER');
  });

  it('never returns the password or its hash, and stores an argon2id hash', async () => {
    const res = await request(buildTestApp()).post('/api/auth/register').send(validBody);
    expect(res.status).toBe(201);

    const stored = await testPrisma().user.findUniqueOrThrow({ where: { id: res.body.id } });

    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.text).not.toContain(stored.passwordHash);
    expect(res.text).not.toContain(validBody.password);

    expect(stored.passwordHash).not.toBe(validBody.password);
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(stored.passwordHash, validBody.password)).toBe(true);
  });
});
