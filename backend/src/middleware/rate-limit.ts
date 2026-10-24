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

/**
 * Ceiling for every client on the whole API, so one address cannot hammer any route. The probes
 * are exempt: an orchestrator must always be able to ask whether the process is alive. Same
 * in-memory store caveat as the login limiter.
 */
export function createGlobalRateLimiter({
  max,
  windowSeconds,
}: Config['rateLimit']): RequestHandler {
  return rateLimit({
    windowMs: windowSeconds * 1000,
    limit: max,
    skip: (req) => req.path === '/health' || req.path === '/ready',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new RateLimitedError('Too many requests. Slow down and try again shortly.')),
  });
}
