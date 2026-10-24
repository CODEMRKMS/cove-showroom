import argon2 from 'argon2';
import type { Role } from '../../src/generated/prisma/client.js';
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
