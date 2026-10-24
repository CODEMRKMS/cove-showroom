import { http, HttpResponse, type HttpHandler } from 'msw';
import type { InventoryEvent, Order, Page, Role, User, Vehicle, VehicleSort } from '../api/types';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: nextId('car'),
    make: 'Honda',
    model: 'City',
    category: 'SEDAN',
    price: 125_000_000,
    quantity: 5,
    year: 2025,
    bodyStyle: 'SEDAN',
    colorOptions: ['#F2F2F2', '#1B1B1B'],
    description: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: nextId('user'),
    email: 'asha@example.com',
    name: 'Asha Rao',
    role: 'USER',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

export const problem = (
  status: number,
  code: string,
  detail: string,
  errors?: { field: string; message: string }[],
) =>
  HttpResponse.json(
    { type: 'about:blank', title: code, status, code, detail, requestId: 'req-test', errors },
    { status },
  );

export type Account = { user: User; password: string };

/**
 * A small in-memory stand-in for the backend, with the same status codes and shapes. Tests change
 * `state` to set the scene and read it afterwards to see what the app did.
 */
export function createFakeApi(initial: { vehicles?: Vehicle[]; accounts?: Account[] } = {}) {
  const state = {
    vehicles: initial.vehicles ?? [],
    accounts: initial.accounts ?? [],
    orders: [] as Order[],
    events: [] as InventoryEvent[],
    /** Who the refresh cookie belongs to; null means no cookie. */
    cookieUser: null as User | null,
    /** Access tokens issued before this epoch are rejected, which simulates expiry. */
    epoch: 1,
    searches: [] as URLSearchParams[],
    /** Add a delay (ms) to vehicle searches, for loading states. */
    searchDelayMs: 0,
    /** Add a delay (ms) to logins, to see the busy state. */
    loginDelayMs: 0,
    /** Make the next N vehicle searches fail with a 500. */
    failSearches: 0,
  };

  const tokenFor = () => `token-${state.epoch}`;
  const userOf = (request: Request): User | 'expired' | null => {
    const header = request.headers.get('Authorization');
    if (!header) return null;
    if (header !== `Bearer ${tokenFor()}`) return 'expired';
    return state.cookieUser;
  };
  const unauthenticated = () => problem(401, 'UNAUTHENTICATED', 'Sign in to continue.');

  /** Runs `handler` for a signed-in user, answering 401 or 403 otherwise. */
  function guard(
    role: Role | null,
    handler: (user: User, request: Request) => Response | Promise<Response>,
  ) {
    return ({ request }: { request: Request }) => {
      const user = userOf(request);
      if (!user || user === 'expired') return unauthenticated();
      if (role && user.role !== role) {
        return problem(403, 'FORBIDDEN', 'You do not have permission to do this.');
      }
      return handler(user, request);
    };
  }

  const notFound = () => problem(404, 'VEHICLE_NOT_FOUND', 'No vehicle with this id.');
  const findVehicle = (id: unknown) => state.vehicles.find((v) => v.id === id);
  const record = (type: InventoryEvent['type'], vehicle: Vehicle, actor: User, delta: number) =>
    state.events.unshift({
      id: nextId('event'),
      type,
      delta,
      quantityAfter: vehicle.quantity,
      createdAt: new Date().toISOString(),
      vehicle: { id: vehicle.id, make: vehicle.make, model: vehicle.model },
      actor: { id: actor.id, name: actor.name },
    });

  const sorters: Record<VehicleSort, (a: Vehicle, b: Vehicle) => number> = {
    '-createdAt': (a, b) => b.createdAt.localeCompare(a.createdAt),
    price: (a, b) => a.price - b.price,
    '-price': (a, b) => b.price - a.price,
    make: (a, b) => a.make.localeCompare(b.make),
  };

  const handlers: HttpHandler[] = [
    http.post('/api/auth/login', async ({ request }) => {
      const body = (await request.json()) as { email: string; password: string };
      if (state.loginDelayMs) await new Promise((r) => setTimeout(r, state.loginDelayMs));
      const account = state.accounts.find(
        (a) => a.user.email === body.email.toLowerCase() && a.password === body.password,
      );
      if (!account) {
        return problem(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      }
      state.cookieUser = account.user;
      return HttpResponse.json({
        accessToken: tokenFor(),
        tokenType: 'Bearer',
        expiresIn: 900,
        user: account.user,
      });
    }),

    http.post('/api/auth/register', async ({ request }) => {
      const body = (await request.json()) as { email: string; password: string; name: string };
      if (body.password.length < 10) {
        return problem(400, 'VALIDATION_ERROR', 'The request is invalid.', [
          { field: 'password', message: 'Use at least 10 characters.' },
        ]);
      }
      if (state.accounts.some((a) => a.user.email === body.email.toLowerCase())) {
        return problem(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
      }
      const user = makeUser({ email: body.email.toLowerCase(), name: body.name });
      state.accounts.push({ user, password: body.password });
      return HttpResponse.json(user, { status: 201 });
    }),

    http.post('/api/auth/refresh', () => {
      if (!state.cookieUser) return unauthenticated();
      return HttpResponse.json({ accessToken: tokenFor(), tokenType: 'Bearer', expiresIn: 900 });
    }),

    http.post('/api/auth/logout', () => {
      state.cookieUser = null;
      return new HttpResponse(null, { status: 204 });
    }),

    http.get(
      '/api/auth/me',
      guard(null, (user) => HttpResponse.json(user)),
    ),

    http.get(
      '/api/vehicles/search',
      guard(null, async (_user, request) => {
        const params = new URL(request.url).searchParams;
        state.searches.push(params);
        if (state.searchDelayMs) await new Promise((r) => setTimeout(r, state.searchDelayMs));
        if (state.failSearches > 0) {
          state.failSearches -= 1;
          return problem(500, 'INTERNAL_ERROR', 'Something went wrong on our side.');
        }
        const q = params.get('q')?.toLowerCase();
        const category = params.get('category');
        const min = params.get('minPrice');
        const max = params.get('maxPrice');
        const sort = (params.get('sort') ?? '-createdAt') as VehicleSort;
        const page = Number(params.get('page') ?? 1);
        const pageSize = Number(params.get('pageSize') ?? 20);
        const matches = state.vehicles
          .filter((v) => !q || `${v.make} ${v.model}`.toLowerCase().includes(q))
          .filter((v) => !category || v.category === category)
          .filter((v) => min === null || v.price >= Number(min))
          .filter((v) => max === null || v.price <= Number(max))
          .filter((v) => params.get('inStock') !== 'true' || v.quantity > 0)
          .sort(sorters[sort]);
        const body: Page<Vehicle> = {
          data: matches.slice((page - 1) * pageSize, page * pageSize),
          meta: {
            page,
            pageSize,
            total: matches.length,
            totalPages: Math.ceil(matches.length / pageSize),
          },
        };
        return HttpResponse.json(body);
      }),
    ),

    http.post(
      '/api/vehicles',
      guard('ADMIN', async (admin, request) => {
        const body = (await request.json()) as Partial<Vehicle>;
        if (!body.make || !body.model || !body.price) {
          return problem(400, 'VALIDATION_ERROR', 'The request is invalid.', [
            { field: !body.make ? 'make' : !body.model ? 'model' : 'price', message: 'Required.' },
          ]);
        }
        const vehicle = makeVehicle({
          ...body,
          bodyStyle: body.bodyStyle ?? body.category ?? 'SEDAN',
          colorOptions: body.colorOptions ?? [],
        });
        state.vehicles.push(vehicle);
        record('CREATED', vehicle, admin, vehicle.quantity);
        return HttpResponse.json(vehicle, { status: 201 });
      }),
    ),

    http.put(
      '/api/vehicles/:id',
      guard('ADMIN', async (admin, request) => {
        const vehicle = findVehicle(new URL(request.url).pathname.split('/').pop());
        if (!vehicle) return notFound();
        Object.assign(vehicle, await request.json(), { updatedAt: new Date().toISOString() });
        record('UPDATED', vehicle, admin, 0);
        return HttpResponse.json(vehicle);
      }),
    ),

    http.delete(
      '/api/vehicles/:id',
      guard('ADMIN', (admin, request) => {
        const vehicle = findVehicle(new URL(request.url).pathname.split('/').pop());
        if (!vehicle) return notFound();
        state.vehicles = state.vehicles.filter((v) => v !== vehicle);
        record('DELETED', vehicle, admin, 0);
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.post(
      '/api/vehicles/:id/purchase',
      guard(null, async (user, request) => {
        const vehicle = findVehicle(new URL(request.url).pathname.split('/')[3]);
        if (!vehicle) return notFound();
        const body = (await request.json().catch(() => ({}))) as { quantity?: number };
        const quantity = body.quantity ?? 1;
        if (vehicle.quantity < quantity) {
          return problem(409, 'OUT_OF_STOCK', `Only ${vehicle.quantity} units left.`);
        }
        vehicle.quantity -= quantity;
        const order: Order = {
          id: nextId('order'),
          userId: user.id,
          vehicleId: vehicle.id,
          quantity,
          unitPrice: vehicle.price,
          totalPrice: vehicle.price * quantity,
          vehicleLabel: `${vehicle.make} ${vehicle.model}`,
          createdAt: new Date().toISOString(),
        };
        state.orders.unshift(order);
        record('PURCHASED', vehicle, user, -quantity);
        return HttpResponse.json({ vehicle, order });
      }),
    ),

    http.post(
      '/api/vehicles/:id/restock',
      guard('ADMIN', async (admin, request) => {
        const vehicle = findVehicle(new URL(request.url).pathname.split('/')[3]);
        if (!vehicle) return notFound();
        const { quantity } = (await request.json()) as { quantity: number };
        vehicle.quantity += quantity;
        record('RESTOCKED', vehicle, admin, quantity);
        return HttpResponse.json(vehicle);
      }),
    ),

    http.get(
      '/api/orders/mine',
      guard(null, (user) => {
        const mine = state.orders.filter((o) => o.userId === user.id);
        const body: Page<Order> = {
          data: mine,
          meta: {
            page: 1,
            pageSize: 20,
            total: mine.length,
            totalPages: Math.max(1, Math.ceil(mine.length / 20)),
          },
        };
        return HttpResponse.json(body);
      }),
    ),

    http.get(
      '/api/admin/events',
      guard('ADMIN', () => HttpResponse.json({ data: state.events.slice(0, 20) })),
    ),
  ];

  return { state, handlers, tokenFor };
}

export type FakeApi = ReturnType<typeof createFakeApi>;
