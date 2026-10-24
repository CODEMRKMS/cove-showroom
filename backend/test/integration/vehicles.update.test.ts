import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { testPrisma } from '../helpers/db.js';
import { createVehicle } from '../helpers/factories.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

async function put(id: string, body: unknown, role: 'USER' | 'ADMIN' = 'ADMIN') {
  const { user, authorization } = await signedInAs(role);
  const res = await request(buildTestApp())
    .put(`/api/vehicles/${id}`)
    .set('Authorization', authorization)
    .send(body as object);
  return { res, user };
}

describe('PUT /api/vehicles/:id', () => {
  it('updates only the fields sent and leaves the rest alone', async () => {
    const vehicle = await createVehicle({
      make: 'Honda',
      model: 'City',
      price: 1_200_000_00n,
      quantity: 7,
    });

    const { res } = await put(vehicle.id, { price: 1_150_000_00 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: vehicle.id,
      make: 'Honda',
      model: 'City',
      price: 1_150_000_00,
      quantity: 7,
    });
    const stored = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(stored.price).toBe(115_000_000n);
    expect(stored.updatedAt.getTime()).toBeGreaterThan(vehicle.updatedAt.getTime());
  });

  it('updates several fields at once, trims text and replaces the colour list', async () => {
    const vehicle = await createVehicle();

    const { res } = await put(vehicle.id, {
      make: '  Hyundai ',
      model: 'Creta',
      category: 'SUV',
      bodyStyle: 'SUV',
      year: 2026,
      colorOptions: ['#111111'],
      description: 'Updated.',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      make: 'Hyundai',
      model: 'Creta',
      category: 'SUV',
      bodyStyle: 'SUV',
      year: 2026,
      colorOptions: ['#111111'],
      description: 'Updated.',
    });
  });

  it('clears the optional year and description when they are sent as null', async () => {
    const vehicle = await createVehicle({ year: 2024 });

    const { res } = await put(vehicle.id, { year: null, description: null });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ year: null, description: null });
  });

  it('records an UPDATED event with no stock change for the acting admin', async () => {
    const vehicle = await createVehicle({ quantity: 3 });

    const { res, user } = await put(vehicle.id, { model: 'Renamed' });

    expect(res.status).toBe(200);
    const events = await testPrisma().inventoryEvent.findMany({ where: { vehicleId: vehicle.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'UPDATED',
      actorId: user.id,
      delta: 0,
      quantityAfter: 3,
    });
  });

  it('refuses a USER with 403 and anonymous callers with 401, changing nothing', async () => {
    const vehicle = await createVehicle({ make: 'Original' });

    const { res: asUser } = await put(vehicle.id, { make: 'Hacked' }, 'USER');
    const anonymous = await request(buildTestApp())
      .put(`/api/vehicles/${vehicle.id}`)
      .send({ make: 'Hacked' });

    expect(asUser.status).toBe(403);
    expect(anonymous.status).toBe(401);
    const stored = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(stored.make).toBe('Original');
  });

  it('answers 404 VEHICLE_NOT_FOUND for an unknown id and for a soft-deleted vehicle', async () => {
    const deleted = await createVehicle({ deletedAt: new Date() });

    const { res: unknown } = await put(MISSING_ID, { make: 'X' });
    const { res: gone } = await put(deleted.id, { make: 'X' });

    for (const res of [unknown, gone]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('VEHICLE_NOT_FOUND');
    }
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const { res } = await put('nope', { make: 'X' });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toContain('id');
  });

  describe('rejects invalid input with 400 VALIDATION_ERROR and changes nothing', () => {
    it.each([
      ['empty body', {}, ''],
      ['blank make', { make: ' ' }, 'make'],
      ['negative price', { price: -5 }, 'price'],
      ['fractional price', { price: 1.5 }, 'price'],
      ['unknown category', { category: 'BOAT' }, 'category'],
      ['bad colour', { colorOptions: ['blue'] }, 'colorOptions.0'],
      ['quantity (use purchase or restock)', { quantity: 10 }, 'quantity'],
      ['client-supplied id', { id: MISSING_ID }, 'id'],
      ['client-supplied deletedAt', { deletedAt: null }, 'deletedAt'],
    ])('%s', async (_name, body, field) => {
      const vehicle = await createVehicle({ make: 'Original', quantity: 2 });

      const { res } = await put(vehicle.id, body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
      const stored = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
      expect(stored).toMatchObject({ make: 'Original', quantity: 2 });
      expect(await testPrisma().inventoryEvent.count()).toBe(0);
    });
  });
});
