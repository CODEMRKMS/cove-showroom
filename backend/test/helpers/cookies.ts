import { createHash } from 'node:crypto';
import type { Response } from 'supertest';

export const REFRESH_COOKIE = 'refresh_token';

/** The full Set-Cookie header line for `name`, or undefined. */
export function setCookieLine(res: Response, name = REFRESH_COOKIE): string | undefined {
  const lines = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return lines.find((line) => line.startsWith(`${name}=`));
}

/** The cookie's value from a response, or undefined when it was not set. */
export function cookieValue(res: Response, name = REFRESH_COOKIE): string | undefined {
  const line = setCookieLine(res, name);
  return line?.split(';')[0]?.slice(name.length + 1);
}

/** Same hashing the API uses to store refresh tokens. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
