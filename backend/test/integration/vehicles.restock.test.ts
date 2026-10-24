import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { testPrisma } from '../helpers/db.js';
import { createVehicle } from '../helpers/factories.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

async function restock(id: string, body?: unknown, role: 'USER' | 'ADMIN' = 'ADMIN') {
  const actor = await signedInAs(role);
  const req = request(buildTestApp())
    .post(`/api/vehicles/${id}/restock`)
    .set('Authorization', actor.authorization);
  const res = await (body === undefined ? req : req.send(body as object));
  return { res, actor };
}

const stockOf = async (id: string): Promise<number> =>
  (await testPrisma().vehicle.findUniqueOrThrow({ where: { id } })).quantity;

describe('POST /api/vehicles/:id/restock', () => {
  it('adds the units and returns the updated vehicle', async () => {
    const vehicle = await createVehicle({ quantity: 2 });

    const { res } = await restock(vehicle.id, { quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: vehicle.id, quantity: 7 });
    expect(await stockOf(vehicle.id)).toBe(7);
  });

  it('records a RESTOCKED event with a positive delta for the acting admin', async () => {
    const vehicle = await createVehicle({ quantity: 2 });

    const { actor } = await restock(vehicle.id, { quantity: 5 });

    const events = await testPrisma().inventoryEvent.findMany({ where: { vehicleId: vehicle.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'RESTOCKED',
      actorId: actor.user.id,
      delta: 5,
      quantityAfter: 7,
    });
  });

  it('puts a sold-out vehicle back on sale', async () => {
    const vehicle = await createVehicle({ quantity: 0 });
    await restock(vehicle.id, { quantity: 1 });
    const buyer = await signedInAs('USER');

    const res = await request(buildTestApp())
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authorization);

    expect(res.status).toBe(200);
    expect(res.body.vehicle.quantity).toBe(0);
  });

  it('refuses a USER with 403 and anonymous callers with 401, changing nothing', async () => {
    const vehicle = await createVehicle({ quantity: 2 });

    const { res: asUser } = await restock(vehicle.id, { quantity: 5 }, 'USER');
    const anonymous = await request(buildTestApp())
      .post(`/api/vehicles/${vehicle.id}/restock`)
      .send({ quantity: 5 });

    expect(asUser.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(await stockOf(vehicle.id)).toBe(2);
    expect(await testPrisma().inventoryEvent.count()).toBe(0);
  });

  it('answers 404 VEHICLE_NOT_FOUND for an unknown id and for a soft-deleted vehicle', async () => {
    const deleted = await createVehicle({ quantity: 2, deletedAt: new Date() });

    const { res: unknown } = await restock(MISSING_ID, { quantity: 1 });
    const { res: gone } = await restock(deleted.id, { quantity: 1 });

    for (const res of [unknown, gone]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('VEHICLE_NOT_FOUND');
    }
    expect(await stockOf(deleted.id)).toBe(2);
    expect(await testPrisma().inventoryEvent.count()).toBe(0);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { res } = await restock('nope', { quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toContain('id');
  });

  describe('rejects invalid bodies with 400 and changes nothing', () => {
    it.each([
      ['no body at all', undefined, 'quantity'],
      ['an empty body', {}, 'quantity'],
      ['zero units', { quantity: 0 }, 'quantity'],
      ['negative units', { quantity: -3 }, 'quantity'],
      ['fractional units', { quantity: 1.5 }, 'quantity'],
      ['units as a string', { quantity: '5' }, 'quantity'],
      ['more than 10,000 units in one go', { quantity: 10_001 }, 'quantity'],
      ['an unknown field', { quantity: 1, price: 1 }, 'price'],
    ])('%s', async (_name, body, field) => {
      const vehicle = await createVehicle({ quantity: 2 });

      const { res } = await restock(vehicle.id, body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
      expect(await stockOf(vehicle.id)).toBe(2);
      expect(await testPrisma().inventoryEvent.count()).toBe(0);
    });
  });

  it('adds up concurrent restocks without losing any', async () => {
    const vehicle = await createVehicle({ quantity: 0 });
    const app = buildTestApp();
    const admins = await Promise.all(Array.from({ length: 8 }, () => signedInAs('ADMIN')));

    const results = await Promise.all(
      admins.map(({ authorization }) =>
        request(app)
          .post(`/api/vehicles/${vehicle.id}/restock`)
          .set('Authorization', authorization)
          .send({ quantity: 3 }),
      ),
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await stockOf(vehicle.id)).toBe(24);
    expect(await testPrisma().inventoryEvent.count({ where: { type: 'RESTOCKED' } })).toBe(8);
  });
});
