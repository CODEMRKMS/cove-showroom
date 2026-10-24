import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { testPrisma } from '../helpers/db.js';
import { createVehicle } from '../helpers/factories.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

async function purchase(id: string, body?: unknown, role: 'USER' | 'ADMIN' = 'USER') {
  const buyer = await signedInAs(role);
  const req = request(buildTestApp())
    .post(`/api/vehicles/${id}/purchase`)
    .set('Authorization', buyer.authorization);
  const res = await (body === undefined ? req : req.send(body as object));
  return { res, buyer };
}

const stockOf = async (id: string): Promise<number> =>
  (await testPrisma().vehicle.findUniqueOrThrow({ where: { id } })).quantity;

describe('POST /api/vehicles/:id/purchase', () => {
  it('buys one unit by default: stock drops by one and the response carries the vehicle and the order', async () => {
    const vehicle = await createVehicle({
      make: 'Kia',
      model: 'Seltos',
      price: 1_400_000_00n,
      quantity: 5,
    });

    const { res } = await purchase(vehicle.id);

    expect(res.status).toBe(200);
    expect(res.body.vehicle).toMatchObject({ id: vehicle.id, quantity: 4 });
    expect(res.body.order).toMatchObject({
      vehicleId: vehicle.id,
      quantity: 1,
      unitPrice: 1_400_000_00,
      totalPrice: 1_400_000_00,
      vehicleLabel: 'Kia Seltos',
    });
    expect(await stockOf(vehicle.id)).toBe(4);
  });

  it('accepts an explicit quantity and totals it from the stored price', async () => {
    const vehicle = await createVehicle({ price: 500_000_00n, quantity: 5 });

    const { res } = await purchase(vehicle.id, { quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.vehicle.quantity).toBe(2);
    expect(res.body.order).toMatchObject({
      quantity: 3,
      unitPrice: 500_000_00,
      totalPrice: 1_500_000_00,
    });
  });

  it('lets the last units go: buying all remaining stock leaves exactly zero', async () => {
    const vehicle = await createVehicle({ quantity: 2 });

    const { res } = await purchase(vehicle.id, { quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.vehicle.quantity).toBe(0);
  });

  it('stores the order for the buyer and a PURCHASED event with a negative delta', async () => {
    const vehicle = await createVehicle({ make: 'Kia', model: 'Sonet', quantity: 5 });

    const { res, buyer } = await purchase(vehicle.id, { quantity: 2 });

    const orders = await testPrisma().order.findMany({ where: { vehicleId: vehicle.id } });
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      id: res.body.order.id,
      userId: buyer.user.id,
      quantity: 2,
      vehicleLabel: 'Kia Sonet',
    });
    const events = await testPrisma().inventoryEvent.findMany({ where: { vehicleId: vehicle.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'PURCHASED',
      actorId: buyer.user.id,
      delta: -2,
      quantityAfter: 3,
    });
  });

  it('keeps the order price when the vehicle price changes afterwards', async () => {
    const vehicle = await createVehicle({ price: 900_000_00n });
    const { res } = await purchase(vehicle.id);

    await testPrisma().vehicle.update({
      where: { id: vehicle.id },
      data: { price: 1_000_000_00n },
    });

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: res.body.order.id } });
    expect(order.unitPrice).toBe(90_000_000n);
  });

  it('lets an admin buy too', async () => {
    const vehicle = await createVehicle();

    const { res } = await purchase(vehicle.id, undefined, 'ADMIN');

    expect(res.status).toBe(200);
  });

  it('requires a signed-in user', async () => {
    const vehicle = await createVehicle();

    const res = await request(buildTestApp()).post(`/api/vehicles/${vehicle.id}/purchase`);

    expect(res.status).toBe(401);
    expect(await stockOf(vehicle.id)).toBe(5);
  });

  describe('when there is not enough stock', () => {
    it('answers 409 OUT_OF_STOCK for a sold-out vehicle and records nothing', async () => {
      const vehicle = await createVehicle({ quantity: 0 });

      const { res } = await purchase(vehicle.id);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        status: 409,
        title: 'Conflict',
        code: 'OUT_OF_STOCK',
        detail: 'Only 0 units left.',
      });
      expect(await stockOf(vehicle.id)).toBe(0);
      expect(await testPrisma().order.count()).toBe(0);
      expect(await testPrisma().inventoryEvent.count()).toBe(0);
    });

    it('answers 409 when the quantity asked for is more than the stock, leaving the stock alone', async () => {
      const vehicle = await createVehicle({ quantity: 3 });

      const { res } = await purchase(vehicle.id, { quantity: 4 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('OUT_OF_STOCK');
      expect(res.body.detail).toBe('Only 3 units left.');
      expect(await stockOf(vehicle.id)).toBe(3);
      expect(await testPrisma().order.count()).toBe(0);
    });

    it('uses the singular when one unit is left', async () => {
      const vehicle = await createVehicle({ quantity: 1 });

      const { res } = await purchase(vehicle.id, { quantity: 2 });

      expect(res.body.detail).toBe('Only 1 unit left.');
    });
  });

  describe('when the vehicle cannot be bought', () => {
    it('answers 404 VEHICLE_NOT_FOUND for an unknown id and for a soft-deleted vehicle', async () => {
      const deleted = await createVehicle({ quantity: 5, deletedAt: new Date() });

      const { res: unknown } = await purchase(MISSING_ID);
      const { res: gone } = await purchase(deleted.id);

      for (const res of [unknown, gone]) {
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('VEHICLE_NOT_FOUND');
      }
      expect(await stockOf(deleted.id)).toBe(5);
      expect(await testPrisma().order.count()).toBe(0);
    });

    it('answers 400 for an id that is not a UUID', async () => {
      const { res } = await purchase('nope');

      expect(res.status).toBe(400);
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain('id');
    });
  });

  describe('rejects invalid bodies with 400 and changes nothing', () => {
    it.each([
      ['zero quantity', { quantity: 0 }, 'quantity'],
      ['negative quantity', { quantity: -1 }, 'quantity'],
      ['fractional quantity', { quantity: 1.5 }, 'quantity'],
      ['quantity as a string', { quantity: '2' }, 'quantity'],
      ['more than 10 in one purchase', { quantity: 11 }, 'quantity'],
      ['a client-supplied price', { price: 1 }, 'price'],
      ['a client-supplied userId', { userId: MISSING_ID }, 'userId'],
    ])('%s', async (_name, body, field) => {
      const vehicle = await createVehicle({ quantity: 20 });

      const { res } = await purchase(vehicle.id, body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
      expect(await stockOf(vehicle.id)).toBe(20);
      expect(await testPrisma().order.count()).toBe(0);
    });
  });

  describe('under concurrent purchases', () => {
    async function buyers(count: number) {
      return Promise.all(Array.from({ length: count }, () => signedInAs('USER')));
    }

    it('sells each of M units exactly once when N > M buyers race for the last of them', async () => {
      const vehicle = await createVehicle({ quantity: 3 });
      const app = buildTestApp();
      const racers = await buyers(10);

      const results = await Promise.all(
        racers.map(({ authorization }) =>
          request(app)
            .post(`/api/vehicles/${vehicle.id}/purchase`)
            .set('Authorization', authorization),
        ),
      );

      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(3);
      expect(statuses.filter((s) => s === 409)).toHaveLength(7);
      for (const res of results.filter((r) => r.status === 409)) {
        expect(res.body.code).toBe('OUT_OF_STOCK');
      }
      expect(await stockOf(vehicle.id)).toBe(0);
      expect(await testPrisma().order.count()).toBe(3);
      const events = await testPrisma().inventoryEvent.findMany({ where: { type: 'PURCHASED' } });
      expect(events).toHaveLength(3);
      expect(events.map((e) => e.quantityAfter).sort()).toEqual([0, 1, 2]);
    });

    it('never oversells when buyers ask for more than one unit each', async () => {
      const vehicle = await createVehicle({ quantity: 5 });
      const app = buildTestApp();
      const racers = await buyers(6);

      const results = await Promise.all(
        racers.map(({ authorization }) =>
          request(app)
            .post(`/api/vehicles/${vehicle.id}/purchase`)
            .set('Authorization', authorization)
            .send({ quantity: 2 }),
        ),
      );

      // 5 units, 2 per buyer: exactly two buyers fit and one unit stays.
      expect(results.filter((r) => r.status === 200)).toHaveLength(2);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
      expect(await stockOf(vehicle.id)).toBe(1);
      expect(await testPrisma().order.count()).toBe(2);
    });
  });
});
