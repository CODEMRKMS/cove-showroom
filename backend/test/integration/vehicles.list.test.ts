import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { createVehicle } from '../helpers/factories.js';

async function list(query = '', role: 'USER' | 'ADMIN' = 'USER') {
  const { authorization } = await signedInAs(role);
  return request(buildTestApp()).get(`/api/vehicles${query}`).set('Authorization', authorization);
}

const makes = (res: request.Response): string[] =>
  res.body.data.map((v: { make: string }) => v.make);

describe('GET /api/vehicles', () => {
  it('requires a signed-in user', async () => {
    const res = await request(buildTestApp()).get('/api/vehicles');

    expect(res.status).toBe(401);
  });

  it('returns data and pagination meta, with defaults of page 1 and 20 per page', async () => {
    await createVehicle({ make: 'Alpha', price: 500_000_00n });

    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ make: 'Alpha', price: 500_000_00 });
    expect(res.body.data[0]).not.toHaveProperty('deletedAt');
  });

  it('returns an empty page with totalPages 0 when there are no vehicles', async () => {
    const res = await list();

    expect(res.body).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
  });

  it('lets an admin list too', async () => {
    const res = await list('', 'ADMIN');

    expect(res.status).toBe(200);
  });

  it('keeps sold-out vehicles visible so the UI can show them as sold out', async () => {
    await createVehicle({ make: 'Gone', quantity: 0 });

    const res = await list();

    expect(makes(res)).toEqual(['Gone']);
  });

  it('hides soft-deleted vehicles and does not count them', async () => {
    await createVehicle({ make: 'Visible' });
    await createVehicle({ make: 'Deleted', deletedAt: new Date() });

    const res = await list();

    expect(makes(res)).toEqual(['Visible']);
    expect(res.body.meta.total).toBe(1);
  });

  describe('pagination', () => {
    it('slices pages and reports totals', async () => {
      for (const make of ['A', 'B', 'C', 'D', 'E']) await createVehicle({ make });

      const last = await list('?page=3&pageSize=2&sort=make');
      const first = await list('?page=1&pageSize=2&sort=make');

      expect(makes(first)).toEqual(['A', 'B']);
      expect(makes(last)).toEqual(['E']);
      expect(last.body.meta).toEqual({ page: 3, pageSize: 2, total: 5, totalPages: 3 });
    });

    it('answers a page past the end with an empty list, not an error', async () => {
      await createVehicle();

      const res = await list('?page=9');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(1);
    });

    it('accepts the maximum page size of 50', async () => {
      const res = await list('?pageSize=50');

      expect(res.status).toBe(200);
      expect(res.body.meta.pageSize).toBe(50);
    });

    it.each([
      ['page size above 50', '?pageSize=51', 'pageSize'],
      ['page size of 0', '?pageSize=0', 'pageSize'],
      ['page of 0', '?page=0', 'page'],
      ['negative page', '?page=-1', 'page'],
      ['non-numeric page', '?page=abc', 'page'],
      ['fractional page size', '?pageSize=2.5', 'pageSize'],
      ['unknown sort', '?sort=colour', 'sort'],
      ['unknown query parameter', '?pagesize=5', 'pagesize'],
    ])('rejects %s with 400', async (_name, query, field) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
    });

    it('keeps pages stable when many vehicles share the sort value', async () => {
      for (let i = 0; i < 6; i += 1) await createVehicle({ price: 100_000_00n });

      const seen = new Set<string>();
      for (const page of [1, 2, 3]) {
        const res = await list(`?sort=price&pageSize=2&page=${page}`);
        for (const v of res.body.data) seen.add(v.id);
      }

      expect(seen.size).toBe(6);
    });
  });

  describe('sorting', () => {
    it('sorts by price ascending and descending', async () => {
      await createVehicle({ make: 'Mid', price: 200_000_00n });
      await createVehicle({ make: 'Cheap', price: 100_000_00n });
      await createVehicle({ make: 'Dear', price: 300_000_00n });

      expect(makes(await list('?sort=price'))).toEqual(['Cheap', 'Mid', 'Dear']);
      expect(makes(await list('?sort=-price'))).toEqual(['Dear', 'Mid', 'Cheap']);
    });

    it('sorts by make alphabetically', async () => {
      for (const make of ['Tata', 'Audi', 'Mahindra']) await createVehicle({ make });

      expect(makes(await list('?sort=make'))).toEqual(['Audi', 'Mahindra', 'Tata']);
    });

    it('sorts newest first with -createdAt, which is also the default', async () => {
      await createVehicle({ make: 'Old', createdAt: new Date('2025-01-01') });
      await createVehicle({ make: 'New', createdAt: new Date('2026-01-01') });
      await createVehicle({ make: 'Mid', createdAt: new Date('2025-06-01') });

      expect(makes(await list('?sort=-createdAt'))).toEqual(['New', 'Mid', 'Old']);
      expect(makes(await list())).toEqual(['New', 'Mid', 'Old']);
    });
  });
});
