import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Role } from '../../src/generated/prisma/client.js';
import { TEST_JWT_SECRET } from './app.js';
import { createUser } from './factories.js';

export const TEST_PASSWORD = 'correct-horse-battery-staple';

/** Persist a user whose password really is TEST_PASSWORD (argon2id), so login can be exercised. */
export async function createUserWithPassword(
  overrides: { email?: string; role?: Role; name?: string } = {},
) {
  return createUser({
    ...overrides,
    passwordHash: await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id }),
  });
}

type TokenOptions = {
  sub: string;
  role?: string;
  secret?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: number;
  algorithm?: jwt.Algorithm;
};

/** Sign an access token the way the API does, with overrides to build deliberately bad ones. */
export function signTestToken(options: TokenOptions): string {
  return jwt.sign({ role: options.role ?? 'USER' }, options.secret ?? TEST_JWT_SECRET, {
    algorithm: options.algorithm ?? 'HS256',
    subject: options.sub,
    issuer: options.issuer ?? 'cove-api',
    audience: options.audience ?? 'cove-web',
    expiresIn: options.expiresIn ?? 900,
  });
}
