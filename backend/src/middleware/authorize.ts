import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthenticatedError } from '../domain/errors.js';
import { ACCESS_POLICY, isAllowed, type RouteKey } from '../policy/access-policy.js';

/**
 * Enforces the policy for one route. Runs after `authenticate`, which sets
 * `req.user`. Looking the policy up at construction means a route with no
 * entry fails when the app is built, not silently at request time.
 */
export function authorize(routeKey: RouteKey): RequestHandler {
  const access = ACCESS_POLICY[routeKey] as (typeof ACCESS_POLICY)[RouteKey] | undefined;
  if (!access) throw new Error(`No access policy defined for "${routeKey}".`);

  const guard: RequestHandler = (req, _res, next) => {
    if (!req.user) return next(new UnauthenticatedError());
    if (!isAllowed(access, req.user.role)) return next(new ForbiddenError());
    next();
  };
  // Exposed so tests can prove every route is guarded by its own policy entry.
  return Object.assign(guard, { policyKey: routeKey });
}
