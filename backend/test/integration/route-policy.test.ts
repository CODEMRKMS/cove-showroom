import { describe, expect, it } from 'vitest';
import { ACCESS_POLICY } from '../../src/policy/access-policy.js';
import { buildTestApp } from '../helpers/app.js';
import {
  DOCUMENTATION_ROUTES,
  PUBLIC_ROUTES,
  guardKey,
  registeredRoutes,
  type RegisteredRoute,
} from '../helpers/routes.js';

describe('route policy coverage', () => {
  const routes = registeredRoutes(buildTestApp());
  const guardKeysOf = (route: RegisteredRoute): string[] =>
    route.handlers.map(guardKey).filter((key): key is string => key !== undefined);
  const isOpen = (key: string): boolean =>
    PUBLIC_ROUTES.includes(key) || DOCUMENTATION_ROUTES.includes(key);

  it('finds the routes it is meant to check', () => {
    expect(routes.map((r) => r.key)).toEqual(expect.arrayContaining(PUBLIC_ROUTES));
    expect(routes.map((r) => r.key)).toContain('GET /api/vehicles');
    expect(routes.map((r) => r.key)).toContain('POST /api/vehicles/:id/purchase');
  });

  it('guards every route that is not explicitly public with authorize() for its own key', () => {
    const unguarded = routes
      .filter((route) => !isOpen(route.key))
      .filter((route) => {
        const keys = guardKeysOf(route);
        return !(keys.length === 1 && keys[0] === route.key);
      })
      .map((route) => route.key);

    expect(unguarded).toEqual([]);
  });

  it('does not guard public routes', () => {
    const guarded = routes
      .filter((route) => isOpen(route.key) && guardKeysOf(route).length > 0)
      .map((route) => route.key);

    expect(guarded).toEqual([]);
  });

  it('never lists a public route in the policy map', () => {
    for (const key of [...PUBLIC_ROUTES, ...DOCUMENTATION_ROUTES]) {
      expect(Object.keys(ACCESS_POLICY)).not.toContain(key);
    }
  });

  it('only registers routes that are in the policy map or the public list', () => {
    const known = new Set([
      ...Object.keys(ACCESS_POLICY),
      ...PUBLIC_ROUTES,
      ...DOCUMENTATION_ROUTES,
    ]);

    expect(routes.map((r) => r.key).filter((key) => !known.has(key))).toEqual([]);
  });

  it('has a registered route for every entry in the policy map, so no rule is dead', () => {
    const registered = new Set(routes.map((r) => r.key));

    expect(Object.keys(ACCESS_POLICY).filter((key) => !registered.has(key))).toEqual([]);
  });
});
