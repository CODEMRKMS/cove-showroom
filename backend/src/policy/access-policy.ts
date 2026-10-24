import type { Role } from '../domain/user.js';

/** Who may call a route: any signed-in user, or only the listed roles. */
export type Access = 'authenticated' | readonly Role[];

const ADMIN_ONLY = ['ADMIN'] as const;

/**
 * The single source of truth for role rules on protected routes. Routes ask
 * `authorize('<METHOD> <path>')`; no handler contains its own role check.
 * Public routes (health, register, login, refresh, logout) are not listed.
 * To change who can do something, change it here and nowhere else.
 */
export const ACCESS_POLICY = {
  'GET /api/auth/me': 'authenticated',

  'POST /api/vehicles': ADMIN_ONLY, // kata: "(For Admin Users) Forms/UI to add ... vehicles"
  'GET /api/vehicles': 'authenticated',
  'GET /api/vehicles/search': 'authenticated',
  'GET /api/vehicles/:id': 'authenticated',
  'PUT /api/vehicles/:id': ADMIN_ONLY, // kata: "... update ... vehicles"
  'DELETE /api/vehicles/:id': ADMIN_ONLY, // kata: "Admin only"
  'POST /api/vehicles/:id/purchase': 'authenticated',
  'POST /api/vehicles/:id/restock': ADMIN_ONLY, // kata: "Admin only"

  'GET /api/orders/mine': 'authenticated',
  'GET /api/admin/events': ADMIN_ONLY,
} as const satisfies Record<string, Access>;

export type RouteKey = keyof typeof ACCESS_POLICY;

export function isAllowed(access: Access, role: Role): boolean {
  return access === 'authenticated' || access.includes(role);
}
