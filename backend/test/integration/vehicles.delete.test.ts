import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { testPrisma } from '../helpers/db.js';
import { createVehicle } from '../helpers/factories.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

async function del(id: string, role: 'USER' | 'ADMIN' = 'ADMIN') {
  const actor = await signedInAs(role);
  const res = await request(buildTestApp())
    .delete(`/api/vehicles/${id}`)
    .set('Authorization', actor.authorization);
  return { res, actor };
}

describe('DELETE /api/vehicles/:id', () => {
  it('soft-deletes: answers 204 with no body and keeps the row, marked with deletedAt', async () => {
    const vehicle = await createVehicle({ quantity: 4 });

    const { res } = await del(vehicle.id);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const stored = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(stored.deletedAt).toBeInstanceOf(Date);
    expect(stored.quantity).toBe(4);
  });

  it('records a DELETED event with no stock change for the acting admin', async () => {
    const vehicle = await createVehicle({ quantity: 4 });

    const { actor } = await del(vehicle.id);

    const events = await testPrisma().inventoryEvent.findMany({ where: { vehicleId: vehicle.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'DELETED',
      actorId: actor.user.id,
      delta: 0,
      quantityAfter: 4,
    });
  });

  it('hides the vehicle from the list, search and get, and blocks every action on it', async () => {
    const vehicle = await createVehicle({ make: 'Vanish', quantity: 4 });
    await del(vehicle.id);
    const { authorization } = await signedInAs('ADMIN');
    const app = buildTestApp();
    const as = <T extends request.Test>(call: T): T =>
      call.set('Authorization', authorization) as T;

    const list = await as(request(app).get('/api/vehicles'));
    const found = await as(request(app).get('/api/vehicles/search').query({ q: 'vanish' }));
    const one = await as(request(app).get(`/api/vehicles/${vehicle.id}`));
    const update = await as(request(app).put(`/api/vehicles/${vehicle.id}`).send({ make: 'X' }));
    const buy = await as(request(app).post(`/api/vehicles/${vehicle.id}/purchase`));
    const restock = await as(
      request(app).post(`/api/vehicles/${vehicle.id}/restock`).send({ quantity: 1 }),
    );

    expect(list.body.data).toEqual([]);
    expect(list.body.meta.total).toBe(0);
    expect(found.body.data).toEqual([]);
    for (const res of [one, update, buy, restock]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('VEHICLE_NOT_FOUND');
    }
  });

  it('keeps existing orders, with their price and name snapshots, after the vehicle is deleted', async () => {
    const vehicle = await createVehicle({
      make: 'Retired',
      model: 'Classic',
      price: 700_000_00n,
      quantity: 3,
    });
    const buyer = await signedInAs('USER');
    const bought = await request(buildTestApp())
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authorization)
      .send({ quantity: 2 });
    expect(bought.status).toBe(200);

    const { res } = await del(vehicle.id);

    expect(res.status).toBe(204);
    const orders = await testPrisma().order.findMany({ where: { userId: buyer.user.id } });
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      vehicleId: vehicle.id,
      quantity: 2,
      unitPrice: 70_000_000n,
      totalPrice: 140_000_000n,
      vehicleLabel: 'Retired Classic',
    });
  });

  it('answers 404 when deleting it a second time, and writes only one event', async () => {
    const vehicle = await createVehicle();

    await del(vehicle.id);
    const { res } = await del(vehicle.id);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('VEHICLE_NOT_FOUND');
    expect(await testPrisma().inventoryEvent.count({ where: { type: 'DELETED' } })).toBe(1);
  });

  it('answers 404 VEHICLE_NOT_FOUND for an unknown id and 400 for a non-UUID', async () => {
    const { res: unknown } = await del(MISSING_ID);
    const { res: malformed } = await del('nope');

    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe('VEHICLE_NOT_FOUND');
    expect(malformed.status).toBe(400);
    expect(malformed.body.errors.map((e: { field: string }) => e.field)).toContain('id');
  });

  it('refuses a USER with 403 and anonymous callers with 401, deleting nothing', async () => {
    const vehicle = await createVehicle();

    const { res: asUser } = await del(vehicle.id, 'USER');
    const anonymous = await request(buildTestApp()).delete(`/api/vehicles/${vehicle.id}`);

    expect(asUser.status).toBe(403);
    expect(anonymous.status).toBe(401);
    const stored = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(stored.deletedAt).toBeNull();
    expect(await testPrisma().inventoryEvent.count()).toBe(0);
  });
});
