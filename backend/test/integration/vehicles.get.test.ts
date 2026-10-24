import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { createVehicle } from '../helpers/factories.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

async function getVehicle(id: string, role: 'USER' | 'ADMIN' = 'USER') {
  const { authorization } = await signedInAs(role);
  return request(buildTestApp()).get(`/api/vehicles/${id}`).set('Authorization', authorization);
}

describe('GET /api/vehicles/:id', () => {
  it('returns the vehicle to any signed-in user', async () => {
    const vehicle = await createVehicle({ make: 'Skoda', model: 'Slavia', price: 1_100_000_00n });

    const asUser = await getVehicle(vehicle.id, 'USER');
    const asAdmin = await getVehicle(vehicle.id, 'ADMIN');

    for (const res of [asUser, asAdmin]) {
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: vehicle.id,
        make: 'Skoda',
        model: 'Slavia',
        price: 1_100_000_00,
        quantity: 5,
        bodyStyle: 'SEDAN',
      });
      expect(res.body).not.toHaveProperty('deletedAt');
    }
  });

  it('requires a signed-in user', async () => {
    const vehicle = await createVehicle();

    const res = await request(buildTestApp()).get(`/api/vehicles/${vehicle.id}`);

    expect(res.status).toBe(401);
  });

  it('answers 404 VEHICLE_NOT_FOUND for an id that does not exist', async () => {
    const res = await getVehicle(MISSING_ID);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'VEHICLE_NOT_FOUND', status: 404, title: 'Not Found' });
  });

  it('answers 404 for a soft-deleted vehicle', async () => {
    const vehicle = await createVehicle({ deletedAt: new Date() });

    const res = await getVehicle(vehicle.id);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('answers 400 VALIDATION_ERROR for an id that is not a UUID, never a database error', async () => {
    const res = await getVehicle('not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toEqual([{ field: 'id', message: expect.any(String) }]);
  });
});
