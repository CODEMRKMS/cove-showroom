import type { RequestHandler } from 'express';
import { describe, expect, it } from 'vitest';
import { ACCESS_POLICY } from '../../src/policy/access-policy.js';
import { buildTestApp } from '../helpers/app.js';

// The only routes allowed to skip authorize(). Everything else must be guarded by the policy map.
const PUBLIC_ROUTES = [
  'GET /api/health',
  'GET /api/ready',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
];

// The slice of Express's internal router structure this test reads (express is pinned to an exact version).
type Layer = {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler }[] };
  matchers?: ((path: string) => false | { path: string })[];
  handle: { stack?: Layer[] };
};

type RegisteredRoute = { key: string; handlers: RequestHandler[] };

// Real paths used to ask a mounted router "which prefix do you serve?" (params replaced by a value).
const SAMPLE_PATHS = [...Object.keys(ACCESS_POLICY), ...PUBLIC_ROUTES].map((key) =>
  key.split(' ')[1]!.replace(/:\w+/g, 'x'),
);

/** The path a router is mounted at, read from Express's own matcher so it cannot drift from app.ts. */
function mountPath(layer: Layer): string {
  for (const sample of SAMPLE_PATHS) {
    const match = layer.matchers?.[0]?.(sample);
    if (match) return match.path === '/' ? '' : match.path;
  }
  throw new Error(
    'Cannot tell where a router is mounted: add one of its routes to the policy map.',
  );
}

/** Every route the real app registers as "METHOD /full/path", with the handlers in front of its controller. */
function registeredRoutes(): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];
  const walk = (layers: Layer[], prefix: string): void => {
    for (const layer of layers) {
      if (layer.route) {
        const { path, methods, stack } = layer.route;
        const fullPath = prefix + (path === '/' ? '' : path);
        for (const method of Object.keys(methods)) {
          routes.push({
            key: `${method.toUpperCase()} ${fullPath}`,
            handlers: stack.map((l) => l.handle),
          });
        }
      } else if (layer.handle.stack) {
        walk(layer.handle.stack, prefix + mountPath(layer));
      }
    }
  };
  walk((buildTestApp() as unknown as { router: { stack: Layer[] } }).router.stack, '');
  return routes;
}

/** The policy key an authorize() guard was built for, if the handler is one. */
const guardKey = (handler: RequestHandler): string | undefined =>
  (handler as RequestHandler & { policyKey?: string }).policyKey;

describe('route policy coverage', () => {
  const routes = registeredRoutes();
  const guardKeysOf = (route: RegisteredRoute): string[] =>
    route.handlers.map(guardKey).filter((key): key is string => key !== undefined);

  it('finds the routes it is meant to check', () => {
    expect(routes.map((r) => r.key)).toEqual(expect.arrayContaining(PUBLIC_ROUTES));
    expect(routes.map((r) => r.key)).toContain('GET /api/vehicles');
    expect(routes.map((r) => r.key)).toContain('POST /api/vehicles/:id/purchase');
  });

  it('guards every route that is not explicitly public with authorize() for its own key', () => {
    const unguarded = routes
      .filter((route) => !PUBLIC_ROUTES.includes(route.key))
      .filter((route) => {
        const keys = guardKeysOf(route);
        return !(keys.length === 1 && keys[0] === route.key);
      })
      .map((route) => route.key);

    expect(unguarded).toEqual([]);
  });

  it('does not guard public routes', () => {
    const guarded = routes
      .filter((route) => PUBLIC_ROUTES.includes(route.key) && guardKeysOf(route).length > 0)
      .map((route) => route.key);

    expect(guarded).toEqual([]);
  });

  it('never lists a public route in the policy map', () => {
    for (const key of PUBLIC_ROUTES) expect(Object.keys(ACCESS_POLICY)).not.toContain(key);
  });

  it('only registers routes that are in the policy map or the public list', () => {
    const known = new Set([...Object.keys(ACCESS_POLICY), ...PUBLIC_ROUTES]);

    expect(routes.map((r) => r.key).filter((key) => !known.has(key))).toEqual([]);
  });
});
