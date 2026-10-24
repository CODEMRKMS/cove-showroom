import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { testPrisma } from '../helpers/db.js';

const VALID = {
  make: 'Maruti Suzuki',
  model: 'Swift',
  category: 'HATCHBACK',
  price: 650_000_00,
  quantity: 4,
  year: 2025,
  colorOptions: ['#B42318', '#1F5FBF'],
  description: 'Demo listing.',
};

describe('POST /api/vehicles', () => {
  it('lets an admin create a vehicle and returns it with a body style defaulted from the category', async () => {
    const admin = await signedInAs('ADMIN');

    const res = await request(buildTestApp())
      .post('/api/vehicles')
      .set('Authorization', admin.authorization)
      .send(VALID);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...VALID, bodyStyle: 'HATCHBACK' });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body).not.toHaveProperty('deletedAt');
    const stored = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.price).toBe(65_000_000n); // integer minor units in the database
  });

  it('keeps an explicit body style and fills optional fields with defaults', async () => {
    const admin = await signedInAs('ADMIN');

    const res = await request(buildTestApp())
      .post('/api/vehicles')
      .set('Authorization', admin.authorization)
      .send({
        make: 'Tata',
        model: 'Nexon',
        category: 'SUV',
        price: 1_000_000_00,
        quantity: 0,
        bodyStyle: 'EV',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ bodyStyle: 'EV', colorOptions: [], quantity: 0 });
  });

  it('records a CREATED inventory event for the acting admin', async () => {
    const admin = await signedInAs('ADMIN');

    const res = await request(buildTestApp())
      .post('/api/vehicles')
      .set('Authorization', admin.authorization)
      .send(VALID);

    const events = await testPrisma().inventoryEvent.findMany({
      where: { vehicleId: res.body.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'CREATED',
      actorId: admin.user.id,
      delta: 4,
      quantityAfter: 4,
    });
  });

  it('refuses a USER with 403 and anonymous callers with 401, creating nothing', async () => {
    const user = await signedInAs('USER');
    const app = buildTestApp();

    const asUser = await request(app)
      .post('/api/vehicles')
      .set('Authorization', user.authorization)
      .send(VALID);
    const anonymous = await request(app).post('/api/vehicles').send(VALID);

    expect(asUser.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(await testPrisma().vehicle.count()).toBe(0);
  });

  describe('rejects invalid input with 400 VALIDATION_ERROR naming the field', () => {
    it.each([
      ['empty make', { make: '' }, 'make'],
      ['blank make', { make: '   ' }, 'make'],
      ['empty model', { model: '' }, 'model'],
      ['unknown category', { category: 'SPACESHIP' }, 'category'],
      ['negative price', { price: -1 }, 'price'],
      ['zero price', { price: 0 }, 'price'],
      ['fractional price', { price: 10.5 }, 'price'],
      ['price as a string', { price: '100' }, 'price'],
      ['absurdly large price', { price: 1e15 }, 'price'],
      ['fractional quantity', { quantity: 1.5 }, 'quantity'],
      ['negative quantity', { quantity: -1 }, 'quantity'],
      ['year in the distant past', { year: 1800 }, 'year'],
      ['colour that is not a hex code', { colorOptions: ['red'] }, 'colorOptions.0'],
      ['unknown body style', { bodyStyle: 'BOAT' }, 'bodyStyle'],
      ['client-supplied id', { id: '11111111-1111-4111-8111-111111111111' }, 'id'],
      ['client-supplied deletedAt', { deletedAt: '2020-01-01T00:00:00Z' }, 'deletedAt'],
    ])('%s', async (_name, patch, field) => {
      const admin = await signedInAs('ADMIN');

      const res = await request(buildTestApp())
        .post('/api/vehicles')
        .set('Authorization', admin.authorization)
        .send({ ...VALID, ...patch });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
      expect(await testPrisma().vehicle.count()).toBe(0);
    });

    it('missing required fields', async () => {
      const admin = await signedInAs('ADMIN');

      const res = await request(buildTestApp())
        .post('/api/vehicles')
        .set('Authorization', admin.authorization)
        .send({});

      expect(res.status).toBe(400);
      const fields = res.body.errors.map((e: { field: string }) => e.field);
      expect(fields).toEqual(
        expect.arrayContaining(['make', 'model', 'category', 'price', 'quantity']),
      );
    });
  });
});
