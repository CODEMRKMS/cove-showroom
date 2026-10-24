import type { Express, RequestHandler } from 'express';
import { ACCESS_POLICY } from '../../src/policy/access-policy.js';

/** Routes that anyone may call without a token. They must not appear in ACCESS_POLICY. */
export const PUBLIC_ROUTES = [
  'GET /api/health',
  'GET /api/ready',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
];

/** Routes that serve the API documentation itself, not part of the documented API. */
export const DOCUMENTATION_ROUTES = ['GET /api/openapi.json'];

// The slice of Express's internal router structure these helpers read (express is pinned to an exact version).
type Layer = {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler }[] };
  matchers?: ((path: string) => false | { path: string })[];
  handle: { stack?: Layer[] };
};

export type RegisteredRoute = { key: string; handlers: RequestHandler[] };

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
export function registeredRoutes(app: Express): RegisteredRoute[] {
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
  walk((app as unknown as { router: { stack: Layer[] } }).router.stack, '');
  return routes;
}

/** The policy key an authorize() guard was built for, if the handler is one. */
export const guardKey = (handler: RequestHandler): string | undefined =>
  (handler as RequestHandler & { policyKey?: string }).policyKey;
