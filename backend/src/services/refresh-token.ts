import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes as base64url (43 characters). The client holds this; the database never does. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this hash is stored, so a database leak does not yield usable tokens. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
