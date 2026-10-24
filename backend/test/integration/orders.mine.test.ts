import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { createOrder, createVehicle } from '../helpers/factories.js';

type Who = Awaited<ReturnType<typeof signedInAs>>;

const mine = (who: Who, query = '') =>
  request(buildTestApp()).get(`/api/orders/mine${query}`).set('Authorization', who.authorization);

const labels = (res: request.Response): string[] =>
  res.body.data.map((o: { vehicleLabel: string }) => o.vehicleLabel);

describe('GET /api/orders/mine', () => {
  it('requires a signed-in user', async () => {
    const res = await request(buildTestApp()).get('/api/orders/mine');

    expect(res.status).toBe(401);
  });

  it('returns an empty page for a user who has bought nothing', async () => {
    const buyer = await signedInAs('USER');

    const res = await mine(buyer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  });

  it('returns the orders with their price and name snapshots, newest first', async () => {
    const buyer = await signedInAs('USER');
    const vehicle = await createVehicle();
    await createOrder({
      userId: buyer.user.id,
      vehicleId: vehicle.id,
      vehicleLabel: 'Kia Seltos',
      quantity: 2,
      unitPrice: 1_400_000_00n,
      createdAt: new Date('2026-01-01T10:00:00Z'),
    });
    await createOrder({
      userId: buyer.user.id,
      vehicleId: vehicle.id,
      vehicleLabel: 'Tata Nexon EV',
      createdAt: new Date('2026-02-01T10:00:00Z'),
    });

    const res = await mine(buyer);

    expect(res.status).toBe(200);
    expect(labels(res)).toEqual(['Tata Nexon EV', 'Kia Seltos']);
    expect(res.body.data[1]).toMatchObject({
      vehicleId: vehicle.id,
      quantity: 2,
      unitPrice: 1_400_000_00,
      totalPrice: 2_800_000_00,
      vehicleLabel: 'Kia Seltos',
      createdAt: '2026-01-01T10:00:00.000Z',
    });
    expect(res.body.data[1].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
  });

  it("never shows another user's orders, not even to an admin", async () => {
    const alice = await signedInAs('USER');
    const bob = await signedInAs('USER');
    const admin = await signedInAs('ADMIN');
    const vehicle = await createVehicle();
    await createOrder({ userId: alice.user.id, vehicleId: vehicle.id, vehicleLabel: 'Alice car' });
    await createOrder({ userId: bob.user.id, vehicleId: vehicle.id, vehicleLabel: 'Bob car' });

    expect(labels(await mine(alice))).toEqual(['Alice car']);
    expect(labels(await mine(bob))).toEqual(['Bob car']);
    expect((await mine(admin)).body.data).toEqual([]);
  });

  it('keeps showing orders for a vehicle that was later soft-deleted', async () => {
    const buyer = await signedInAs('USER');
    const vehicle = await createVehicle({ deletedAt: new Date() });
    await createOrder({
      userId: buyer.user.id,
      vehicleId: vehicle.id,
      vehicleLabel: 'Retired Car',
    });

    const res = await mine(buyer);

    expect(labels(res)).toEqual(['Retired Car']);
  });

  it('shows a purchase made through the API straight away', async () => {
    const buyer = await signedInAs('USER');
    const vehicle = await createVehicle({ make: 'Kia', model: 'Sonet', quantity: 3 });
    await request(buildTestApp())
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authorization);

    const res = await mine(buyer);

    expect(labels(res)).toEqual(['Kia Sonet']);
  });

  describe('pagination', () => {
    it('slices pages and reports totals', async () => {
      const buyer = await signedInAs('USER');
      const vehicle = await createVehicle();
      for (const [i, label] of ['A', 'B', 'C', 'D', 'E'].entries()) {
        await createOrder({
          userId: buyer.user.id,
          vehicleId: vehicle.id,
          vehicleLabel: label,
          createdAt: new Date(2026, 0, i + 1),
        });
      }

      const second = await mine(buyer, '?page=2&pageSize=2');
      const last = await mine(buyer, '?page=3&pageSize=2');

      expect(labels(second)).toEqual(['C', 'B']);
      expect(labels(last)).toEqual(['A']);
      expect(last.body.meta).toEqual({ page: 3, pageSize: 2, total: 5, totalPages: 3 });
    });

    it.each([
      ['page size above 50', '?pageSize=51', 'pageSize'],
      ['page of 0', '?page=0', 'page'],
      ['non-numeric page', '?page=abc', 'page'],
      ['a sort parameter, which orders do not support', '?sort=price', 'sort'],
      ['an unknown parameter', '?status=paid', 'status'],
    ])('rejects %s with 400', async (_name, query, field) => {
      const buyer = await signedInAs('USER');

      const res = await mine(buyer, query);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
    });
  });
});
