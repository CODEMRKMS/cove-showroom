import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { createInventoryEvent, createVehicle } from '../helpers/factories.js';

type Who = Awaited<ReturnType<typeof signedInAs>>;

const feed = (who: Who, query = '') =>
  request(buildTestApp()).get(`/api/admin/events${query}`).set('Authorization', who.authorization);

const types = (res: request.Response): string[] =>
  res.body.data.map((e: { type: string }) => e.type);

describe('GET /api/admin/events', () => {
  it('refuses a USER with 403 and anonymous callers with 401', async () => {
    const user = await signedInAs('USER');

    const asUser = await feed(user);
    const anonymous = await request(buildTestApp()).get('/api/admin/events');

    expect(asUser.status).toBe(403);
    expect(asUser.body.code).toBe('FORBIDDEN');
    expect(anonymous.status).toBe(401);
  });

  it('returns an empty feed when nothing has happened yet', async () => {
    const admin = await signedInAs('ADMIN');

    const res = await feed(admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });

  it('lists events newest first with the vehicle and who did it', async () => {
    const admin = await signedInAs('ADMIN');
    const vehicle = await createVehicle({ make: 'Kia', model: 'Seltos' });
    await createInventoryEvent({
      vehicleId: vehicle.id,
      actorId: admin.user.id,
      type: 'CREATED',
      delta: 5,
      quantityAfter: 5,
      createdAt: new Date('2026-03-01T09:00:00Z'),
    });
    await createInventoryEvent({
      vehicleId: vehicle.id,
      actorId: admin.user.id,
      type: 'PURCHASED',
      delta: -2,
      quantityAfter: 3,
      createdAt: new Date('2026-03-02T09:00:00Z'),
    });

    const res = await feed(admin);

    expect(res.status).toBe(200);
    expect(types(res)).toEqual(['PURCHASED', 'CREATED']);
    expect(res.body.data[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      type: 'PURCHASED',
      delta: -2,
      quantityAfter: 3,
      createdAt: '2026-03-02T09:00:00.000Z',
      vehicle: { id: vehicle.id, make: 'Kia', model: 'Seltos' },
      actor: { id: admin.user.id, name: admin.user.name },
    });
  });

  it('exposes no email or password hash for the people involved', async () => {
    const admin = await signedInAs('ADMIN');
    const buyer = await signedInAs('USER');
    const vehicle = await createVehicle();
    await createInventoryEvent({
      vehicleId: vehicle.id,
      actorId: buyer.user.id,
      type: 'PURCHASED',
    });

    const res = await feed(admin);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.text).not.toContain(buyer.user.email);
    expect(res.text).not.toContain('passwordHash');
    expect(res.text).not.toContain('not-a-real-hash');
  });

  it('still names a vehicle that has since been soft-deleted', async () => {
    const admin = await signedInAs('ADMIN');
    const vehicle = await createVehicle({
      make: 'Retired',
      model: 'Classic',
      deletedAt: new Date(),
    });
    await createInventoryEvent({ vehicleId: vehicle.id, actorId: admin.user.id, type: 'DELETED' });

    const res = await feed(admin);

    expect(res.body.data[0].vehicle).toMatchObject({ make: 'Retired', model: 'Classic' });
  });

  it('records what admins and buyers actually do through the API, in order', async () => {
    const admin = await signedInAs('ADMIN');
    const buyer = await signedInAs('USER');
    const app = buildTestApp();

    const created = await request(app)
      .post('/api/vehicles')
      .set('Authorization', admin.authorization)
      .send({ make: 'Skoda', model: 'Kylaq', category: 'SUV', price: 900_000_00, quantity: 3 });
    const id = created.body.id as string;
    await request(app)
      .post(`/api/vehicles/${id}/purchase`)
      .set('Authorization', buyer.authorization);
    await request(app)
      .post(`/api/vehicles/${id}/restock`)
      .set('Authorization', admin.authorization)
      .send({ quantity: 4 });
    await request(app).delete(`/api/vehicles/${id}`).set('Authorization', admin.authorization);

    const res = await feed(admin);

    expect(types(res)).toEqual(['DELETED', 'RESTOCKED', 'PURCHASED', 'CREATED']);
    expect(res.body.data.map((e: { actor: { id: string } }) => e.actor.id)).toEqual([
      admin.user.id,
      admin.user.id,
      buyer.user.id,
      admin.user.id,
    ]);
  });

  describe('limit', () => {
    it('defaults to 20 events and honours a smaller limit', async () => {
      const admin = await signedInAs('ADMIN');
      const vehicle = await createVehicle();
      for (let i = 0; i < 25; i += 1) {
        await createInventoryEvent({
          vehicleId: vehicle.id,
          actorId: admin.user.id,
          createdAt: new Date(2026, 0, 1, 0, i),
        });
      }

      const byDefault = await feed(admin);
      const three = await feed(admin, '?limit=3');
      const max = await feed(admin, '?limit=100');

      expect(byDefault.body.data).toHaveLength(20);
      expect(three.body.data).toHaveLength(3);
      expect(max.body.data).toHaveLength(25);
    });

    it('keeps the newest events when it cuts the list', async () => {
      const admin = await signedInAs('ADMIN');
      const vehicle = await createVehicle();
      await createInventoryEvent({
        vehicleId: vehicle.id,
        actorId: admin.user.id,
        type: 'CREATED',
        createdAt: new Date('2026-01-01'),
      });
      await createInventoryEvent({
        vehicleId: vehicle.id,
        actorId: admin.user.id,
        type: 'DELETED',
        createdAt: new Date('2026-02-01'),
      });

      const res = await feed(admin, '?limit=1');

      expect(types(res)).toEqual(['DELETED']);
    });

    it.each([
      ['0', '?limit=0', 'limit'],
      ['101', '?limit=101', 'limit'],
      ['a fraction', '?limit=2.5', 'limit'],
      ['text', '?limit=lots', 'limit'],
      ['an unknown parameter', '?type=PURCHASED', 'type'],
    ])('rejects %s with 400', async (_name, query, field) => {
      const admin = await signedInAs('ADMIN');

      const res = await feed(admin, query);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
    });
  });
});
