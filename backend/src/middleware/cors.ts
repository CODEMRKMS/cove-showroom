import cors from 'cors';
import type { RequestHandler } from 'express';

/**
 * Browsers may call the API only from the listed origins. Anything else gets no CORS headers at
 * all (not even Allow-Credentials), so the browser blocks the response. Requests without an
 * Origin header (curl, server to server) are unaffected.
 */
export function corsAllowList(allowedOrigins: string[]): RequestHandler {
  return cors((req, callback) => {
    const origin = req.headers.origin;
    if (origin === undefined || !allowedOrigins.includes(origin)) {
      callback(null, { origin: false });
      return;
    }
    callback(null, {
      origin: true,
      credentials: true,
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    });
  });
}
