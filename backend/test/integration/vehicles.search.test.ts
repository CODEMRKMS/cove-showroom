import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { signedInAs } from '../helpers/auth.js';
import { createVehicle } from '../helpers/factories.js';

/** Rupees to the minor units the API and database use. */
const rupees = (amount: number): bigint => BigInt(amount) * 100n;
const paise = (amount: number): number => amount * 100;

async function search(
  params: Record<string, string | number> = {},
  role: 'USER' | 'ADMIN' = 'USER',
) {
  const { authorization } = await signedInAs(role);
  return request(buildTestApp())
    .get('/api/vehicles/search')
    .query({ sort: 'make', ...params })
    .set('Authorization', authorization);
}

const models = (res: request.Response): string[] =>
  res.body.data.map((v: { model: string }) => v.model);
const fieldsOf = (res: request.Response): string[] =>
  res.body.errors.map((e: { field: string }) => e.field);

beforeEach(async () => {
  await createVehicle({
    make: 'Maruti Suzuki',
    model: 'Swift',
    category: 'HATCHBACK',
    price: rupees(650_000),
    quantity: 5,
  });
  await createVehicle({
    make: 'Maruti Suzuki',
    model: 'Dzire',
    category: 'SEDAN',
    price: rupees(800_000),
    quantity: 0,
  });
  await createVehicle({
    make: 'Hyundai',
    model: 'Creta',
    category: 'SUV',
    price: rupees(1_500_000),
    quantity: 3,
  });
  await createVehicle({
    make: 'Hyundai',
    model: 'Verna',
    category: 'SEDAN',
    price: rupees(1_300_000),
    quantity: 2,
  });
  await createVehicle({
    make: 'Tata',
    model: 'Nexon EV',
    category: 'EV',
    price: rupees(1_600_000),
    quantity: 4,
  });
  await createVehicle({
    make: 'Tata',
    model: 'Harrier',
    category: 'SUV',
    price: rupees(2_000_000),
    quantity: 0,
  });
  await createVehicle({
    make: 'Maruti Suzuki',
    model: 'Ghost',
    category: 'HATCHBACK',
    deletedAt: new Date(),
  });
});

describe('GET /api/vehicles/search', () => {
  it('requires a signed-in user', async () => {
    const res = await request(buildTestApp()).get('/api/vehicles/search');

    expect(res.status).toBe(401);
  });

  it('is reachable as a route of its own, not read as a vehicle id', async () => {
    const res = await search();

    expect(res.status).toBe(200);
  });

  it('with no filters lists every live vehicle with pagination meta', async () => {
    const res = await search();

    expect(models(res)).toEqual(['Dzire', 'Swift', 'Creta', 'Verna', 'Nexon EV', 'Harrier']);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 6, totalPages: 1 });
  });

  describe('q (make or model, case-insensitive)', () => {
    it.each([
      ['swift', ['Swift']],
      ['SWIFT', ['Swift']],
      ['SwIfT', ['Swift']],
      ['hyun', ['Creta', 'Verna']],
      ['nexon', ['Nexon EV']],
      ['maruti swift', ['Swift']],
      ['swift maruti', ['Swift']],
      ['  tata  ', ['Nexon EV', 'Harrier']],
    ])('%j finds %j', async (q, expected) => {
      const res = await search({ q });

      expect(res.status).toBe(200);
      expect(models(res)).toEqual(expected);
    });

    it('treats % and _ as plain characters, not wildcards', async () => {
      expect(models(await search({ q: '%' }))).toEqual([]);
      expect(models(await search({ q: 'S_ift' }))).toEqual([]);
    });

    it('never returns soft-deleted vehicles', async () => {
      expect(models(await search({ q: 'ghost' }))).toEqual([]);
    });

    it('rejects a blank q and one that is far too long', async () => {
      for (const q of ['   ', 'x'.repeat(101)]) {
        const res = await search({ q });
        expect(res.status).toBe(400);
        expect(fieldsOf(res)).toContain('q');
      }
    });
  });

  describe('make and model filters (whole value, case-insensitive)', () => {
    it('filters by make', async () => {
      expect(models(await search({ make: 'hyundai' }))).toEqual(['Creta', 'Verna']);
      expect(models(await search({ make: 'MARUTI SUZUKI' }))).toEqual(['Dzire', 'Swift']);
    });

    it('does not match part of a make', async () => {
      expect(models(await search({ make: 'hyun' }))).toEqual([]);
    });

    it('filters by model', async () => {
      expect(models(await search({ model: 'creta' }))).toEqual(['Creta']);
    });
  });

  describe('category', () => {
    it('filters by category', async () => {
      expect(models(await search({ category: 'SUV' }))).toEqual(['Creta', 'Harrier']);
      expect(models(await search({ category: 'EV' }))).toEqual(['Nexon EV']);
    });

    it('answers an empty result, not an error, when nothing matches', async () => {
      const res = await search({ category: 'CONVERTIBLE' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    });

    it('rejects an unknown category', async () => {
      const res = await search({ category: 'BOAT' });

      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('category');
    });
  });

  describe('price range (minor units, both ends inclusive)', () => {
    it('minPrice keeps vehicles at or above it', async () => {
      const res = await search({ minPrice: paise(1_300_000) });

      expect(models(res)).toEqual(['Creta', 'Verna', 'Nexon EV', 'Harrier']);
    });

    it('maxPrice keeps vehicles at or below it', async () => {
      const res = await search({ maxPrice: paise(1_300_000) });

      expect(models(res)).toEqual(['Dzire', 'Swift', 'Verna']);
    });

    it('equal bounds match a vehicle priced exactly there', async () => {
      const res = await search({ minPrice: paise(1_300_000), maxPrice: paise(1_300_000) });

      expect(models(res)).toEqual(['Verna']);
    });

    it('one paisa outside the bounds excludes the vehicle', async () => {
      const res = await search({
        minPrice: paise(1_300_000) + 1,
        maxPrice: paise(1_500_000) - 1,
      });

      expect(models(res)).toEqual([]);
    });

    it('rejects min greater than max, naming minPrice', async () => {
      const res = await search({ minPrice: paise(2_000_000), maxPrice: paise(1_000_000) });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(res)).toContain('minPrice');
    });

    it.each([
      ['negative minPrice', { minPrice: -1 }, 'minPrice'],
      ['fractional maxPrice', { maxPrice: 10.5 }, 'maxPrice'],
      ['non-numeric minPrice', { minPrice: 'cheap' }, 'minPrice'],
      ['empty maxPrice', { maxPrice: '' }, 'maxPrice'],
    ])('rejects %s', async (_name, params, field) => {
      const res = await search(params);

      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain(field);
    });
  });

  describe('inStock', () => {
    it('true keeps only vehicles with stock', async () => {
      const res = await search({ inStock: 'true' });

      expect(models(res)).toEqual(['Swift', 'Creta', 'Verna', 'Nexon EV']);
    });

    it('false keeps only sold-out vehicles', async () => {
      const res = await search({ inStock: 'false' });

      expect(models(res)).toEqual(['Dzire', 'Harrier']);
    });

    it('rejects anything else', async () => {
      const res = await search({ inStock: 'yes' });

      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('inStock');
    });
  });

  describe('filters combined', () => {
    it('q and category', async () => {
      expect(models(await search({ q: 'tata', category: 'SUV' }))).toEqual(['Harrier']);
    });

    it('make, inStock and maxPrice', async () => {
      const res = await search({ make: 'Hyundai', inStock: 'true', maxPrice: paise(1_400_000) });

      expect(models(res)).toEqual(['Verna']);
    });

    it('every filter at once', async () => {
      const res = await search({
        q: 'creta',
        make: 'Hyundai',
        model: 'Creta',
        category: 'SUV',
        minPrice: paise(1_000_000),
        maxPrice: paise(1_500_000),
        inStock: 'true',
      });

      expect(models(res)).toEqual(['Creta']);
    });

    it('filters that contradict each other give an empty result', async () => {
      expect(models(await search({ make: 'Tata', category: 'HATCHBACK' }))).toEqual([]);
    });
  });

  describe('sorting and pagination apply to the matches', () => {
    it('sorts by price descending', async () => {
      const res = await search({ category: 'SEDAN', sort: '-price' });

      expect(models(res)).toEqual(['Verna', 'Dzire']);
    });

    it('pages through matches and totals only the matches', async () => {
      const res = await search({ category: 'SUV', pageSize: 1, page: 2, sort: 'price' });

      expect(models(res)).toEqual(['Harrier']);
      expect(res.body.meta).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    });

    it('rejects the same bad paging as the list', async () => {
      const res = await search({ pageSize: 51 });

      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('pageSize');
    });

    it('rejects unknown query parameters', async () => {
      const res = await search({ colour: 'red' });

      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toContain('colour');
    });
  });
});
