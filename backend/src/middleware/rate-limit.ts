import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Config } from '../config.js';
import { RateLimitedError } from '../domain/errors.js';

/**
 * Brute-force guard for login: counts failed attempts per client IP.
 * Successful logins are not counted, so legitimate users are never locked out
 * by their own activity. The store is in memory, so it resets on restart and
 * is per process; fine for one instance, swap the store to scale out.
 */
export function createLoginRateLimiter({
  max,
  windowSeconds,
}: Config['authRateLimit']): RequestHandler {
  return rateLimit({
    windowMs: windowSeconds * 1000,
    limit: max,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new RateLimitedError()),
  });
}
