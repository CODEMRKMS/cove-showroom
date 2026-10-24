import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { SORT_OPTIONS } from '../../src/domain/pagination.js';
import { CATEGORIES } from '../../src/domain/vehicle.js';
import { ACCESS_POLICY } from '../../src/policy/access-policy.js';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { createVehicle } from '../helpers/factories.js';
import { DOCUMENTATION_ROUTES, PUBLIC_ROUTES, registeredRoutes } from '../helpers/routes.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- the OpenAPI document is untyped JSON here */
type Doc = any;

const HTTP_METHODS = ['get', 'post', 'put', 'delete'] as const;

let doc: Doc;
const app = buildTestApp();

beforeAll(async () => {
  doc = (await request(app).get('/api/openapi.json')).body;
});

/** Follows a local "#/components/..." reference. */
function resolve(node: any): any {
  if (node && typeof node === 'object' && typeof node.$ref === 'string') {
    const target = node.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce((value: any, part: string) => value?.[part], doc);
    if (target === undefined) throw new Error(`Unresolved reference ${node.$ref}`);
    return resolve(target);
  }
  return node;
}

const schema = (name: string): any => doc.components.schemas[name];
const propertyNames = (name: string): string[] => Object.keys(schema(name).properties).sort();
const keys = (value: object): string[] => Object.keys(value).sort();

/** "GET /api/vehicles/{id}" operations as the router names them: "GET /api/vehicles/:id". */
function documentedOperations(): { key: string; operation: any }[] {
  return Object.entries<any>(doc.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => item[method]).map((method) => ({
      key: `${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`,
      operation: item[method],
    })),
  );
}

function collectRefs(node: any, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((child) => collectRefs(child, found));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') found.push(value);
      else collectRefs(value, found);
    }
  }
  return found;
}

describe('serving the documentation', () => {
  it('serves the OpenAPI document as JSON without a token', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toBe('Cove API');
    expect(res.body.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('serves the Swagger UI page at /api/docs/ without a token', async () => {
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('swagger-ui');
  });

  it('does not describe any route that needs documenting but is missing, or the reverse', () => {
    const documented = documentedOperations().map((o) => o.key);
    const registered = registeredRoutes(app)
      .map((r) => r.key)
      .filter((key) => !DOCUMENTATION_ROUTES.includes(key));

    expect(documented.filter((key) => !registered.includes(key))).toEqual([]);
    expect(registered.filter((key) => !documented.includes(key))).toEqual([]);
  });
});

describe('the document stays consistent with the access policy', () => {
  it('requires a bearer token on exactly the routes in the policy map and none of the public ones', () => {
    for (const { key, operation } of documentedOperations()) {
      if (PUBLIC_ROUTES.includes(key)) {
        expect(operation.security, key).toEqual([]);
      } else {
        expect(operation.security, key).toEqual([{ bearerAuth: [] }]);
        expect(Object.keys(ACCESS_POLICY), key).toContain(key);
      }
    }
  });

  it('marks admin-only operations with x-required-role ADMIN and no others', () => {
    for (const { key, operation } of documentedOperations()) {
      const access = (ACCESS_POLICY as Record<string, unknown>)[key];
      const adminOnly = Array.isArray(access) && access.includes('ADMIN');
      expect(operation['x-required-role'], key).toBe(adminOnly ? 'ADMIN' : undefined);
      if (adminOnly) expect(operation.description, key).toMatch(/admin/i);
    }
  });

  it('documents 401 on every protected route and 403 only where a role is required', () => {
    for (const { key, operation } of documentedOperations()) {
      const codes = Object.keys(operation.responses);
      const protectedRoute = !PUBLIC_ROUTES.includes(key);
      const adminOnly = operation['x-required-role'] === 'ADMIN';
      if (protectedRoute) expect(codes, key).toContain('401');
      expect(codes.includes('403'), key).toBe(adminOnly);
    }
  });
});

describe('the document is well formed', () => {
  it('gives every operation a unique id, a summary and a tag', () => {
    const ids = documentedOperations().map(({ operation }) => operation.operationId);

    expect(new Set(ids).size).toBe(ids.length);
    for (const { key, operation } of documentedOperations()) {
      expect(operation.operationId, key).toEqual(expect.any(String));
      expect(operation.summary, key).toEqual(expect.any(String));
      expect(operation.tags?.length, key).toBeGreaterThan(0);
    }
  });

  it('resolves every $ref', () => {
    const refs = collectRefs(doc);

    expect(refs.length).toBeGreaterThan(20);
    for (const ref of refs) expect(() => resolve({ $ref: ref }), ref).not.toThrow();
  });

  it('describes every error response with the Problem schema', () => {
    for (const { key, operation } of documentedOperations()) {
      for (const [status, response] of Object.entries<any>(operation.responses)) {
        if (status.startsWith('2')) continue;
        const body = resolve(response).content?.['application/json']?.schema;
        expect(body, `${key} ${status}`).toEqual({ $ref: '#/components/schemas/Problem' });
      }
    }
  });

  it('declares the id parameter as a UUID and documents 400 and 404 for routes that take one', () => {
    const withId = documentedOperations().filter(({ key }) => key.includes(':id'));

    // get, put, delete, purchase and restock
    expect(withId.length).toBeGreaterThanOrEqual(5);
    for (const { key, operation } of withId) {
      const params = [...(operation.parameters ?? [])].map(resolve);
      const id = params.find((p: any) => p.name === 'id');
      expect(id, key).toMatchObject({ in: 'path', required: true, schema: { format: 'uuid' } });
      expect(Object.keys(operation.responses), key).toEqual(expect.arrayContaining(['400', '404']));
    }
  });

  it('documents 409 OUT_OF_STOCK on purchase', () => {
    const purchase = doc.paths['/api/vehicles/{id}/purchase'].post;

    expect(Object.keys(purchase.responses)).toContain('409');
  });

  it('lists the same categories and sort options the API accepts', () => {
    expect([...schema('Vehicle').properties.category.enum].sort()).toEqual([...CATEGORIES].sort());
    const search = doc.paths['/api/vehicles/search'].get;
    const sort = [...search.parameters].map(resolve).find((p: any) => p.name === 'sort');
    expect([...sort.schema.enum].sort()).toEqual([...SORT_OPTIONS].sort());
  });
});

describe('documented request bodies match what the API requires', () => {
  const MISSING_ID = '00000000-0000-4000-8000-000000000000';

  it.each([
    ['CreateVehicleRequest', '/api/vehicles', 'ADMIN'],
    ['RegisterRequest', '/api/auth/register', undefined],
    ['LoginRequest', '/api/auth/login', undefined],
    ['RestockRequest', `/api/vehicles/${MISSING_ID}/restock`, 'ADMIN'],
  ] as const)(
    '%s lists exactly the fields the API reports as missing',
    async (name, path, role) => {
      const call = request(app).post(path);
      if (role) call.set('Authorization', (await signedInAs(role)).authorization);

      const res = await call.send({});

      expect(res.status).toBe(400);
      const missing = res.body.errors.map((e: { field: string }) => e.field).sort();
      expect([...schema(name).required].sort()).toEqual(missing);
      expect(schema(name).additionalProperties).toBe(false);
    },
  );
});

describe('documented responses have the shape the API really returns', () => {
  it('Problem, FieldError and the validation envelope', async () => {
    const notFound = await request(app).get('/api/nope');
    const invalid = await request(app).post('/api/auth/register').send({});

    expect(keys(notFound.body)).toEqual(
      propertyNames('Problem').filter((name) => name !== 'errors'),
    );
    expect(keys(invalid.body)).toEqual(propertyNames('Problem'));
    expect(keys(invalid.body.errors[0])).toEqual(propertyNames('FieldError'));
  });

  it('health and readiness', async () => {
    expect(keys((await request(app).get('/api/health')).body)).toEqual(
      propertyNames('HealthStatus'),
    );
    expect(keys((await request(app).get('/api/ready')).body)).toEqual(
      propertyNames('HealthStatus'),
    );
  });

  it('register, login, refresh and me', async () => {
    const agent = request.agent(app);
    const credentials = { email: 'doc@example.test', password: 'a-long-test-passphrase' };

    const registered = await agent.post('/api/auth/register').send({ ...credentials, name: 'Doc' });
    const loggedIn = await agent.post('/api/auth/login').send(credentials);
    const refreshed = await agent.post('/api/auth/refresh');
    const me = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loggedIn.body.accessToken}`);

    expect(keys(registered.body)).toEqual(propertyNames('PublicUser'));
    expect(keys(loggedIn.body)).toEqual(propertyNames('LoginResponse'));
    expect(keys(loggedIn.body.user)).toEqual(propertyNames('PublicUser'));
    expect(keys(refreshed.body)).toEqual(propertyNames('TokenResponse'));
    expect(keys(me.body)).toEqual(propertyNames('PublicUser'));
  });

  it('vehicles: create, get, list, search, update, restock', async () => {
    const admin = await signedInAs('ADMIN');
    const auth = { Authorization: admin.authorization };
    const created = await request(app)
      .post('/api/vehicles')
      .set(auth)
      .send({ make: 'Doc', model: 'Car', category: 'SEDAN', price: 100_000_00, quantity: 2 });
    const id = created.body.id as string;
    const one = await request(app).get(`/api/vehicles/${id}`).set(auth);
    const list = await request(app).get('/api/vehicles').set(auth);
    const search = await request(app).get('/api/vehicles/search').set(auth);
    const updated = await request(app).put(`/api/vehicles/${id}`).set(auth).send({ make: 'Doc2' });
    const restocked = await request(app)
      .post(`/api/vehicles/${id}/restock`)
      .set(auth)
      .send({ quantity: 1 });

    for (const res of [created, one, updated, restocked]) {
      expect(keys(res.body)).toEqual(propertyNames('Vehicle'));
    }
    for (const page of [list, search]) {
      expect(keys(page.body)).toEqual(propertyNames('VehiclePage'));
      expect(keys(page.body.meta)).toEqual(propertyNames('PageMeta'));
      expect(keys(page.body.data[0])).toEqual(propertyNames('Vehicle'));
    }
    expect(created.status).toBe(201);
  });

  it('purchase, my orders and the admin event feed', async () => {
    const admin = await signedInAs('ADMIN');
    const buyer = await signedInAs('USER');
    const vehicle = await createVehicle({ quantity: 3 });

    const bought = await request(app)
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authorization);
    const mine = await request(app)
      .get('/api/orders/mine')
      .set('Authorization', buyer.authorization);
    const feed = await request(app)
      .get('/api/admin/events')
      .set('Authorization', admin.authorization);

    expect(keys(bought.body)).toEqual(propertyNames('PurchaseResponse'));
    expect(keys(bought.body.order)).toEqual(propertyNames('Order'));
    expect(keys(mine.body)).toEqual(propertyNames('OrderPage'));
    expect(keys(mine.body.data[0])).toEqual(propertyNames('Order'));
    expect(keys(feed.body)).toEqual(propertyNames('EventFeed'));
    expect(keys(feed.body.data[0])).toEqual(propertyNames('InventoryEvent'));
    expect(keys(feed.body.data[0].vehicle)).toEqual(
      Object.keys(schema('InventoryEvent').properties.vehicle.properties).sort(),
    );
    expect(keys(feed.body.data[0].actor)).toEqual(
      Object.keys(schema('InventoryEvent').properties.actor.properties).sort(),
    );
  });
});
