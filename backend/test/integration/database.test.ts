import { describe, expect, it } from 'vitest';
import { createUser, createVehicle } from '../helpers/factories.js';
import { testPrisma } from '../helpers/db.js';

// Guards the test infrastructure itself: real PostgreSQL, migrations applied,
// constraints enforced by the database, tables emptied between tests.
describe('test database', () => {
  it('connects to PostgreSQL', async () => {
    const rows = await testPrisma().$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(rows[0]?.ok).toBe(1);
  });

  it('has the migrated tables', async () => {
    const rows = await testPrisma().$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    expect(rows.map((r) => r.tablename)).toEqual(
      expect.arrayContaining(['User', 'Vehicle', 'Order', 'InventoryEvent', 'RefreshToken']),
    );
  });

  it('rejects negative stock at the database level', async () => {
    await expect(createVehicle({ quantity: -1 })).rejects.toThrow();
  });

  it('rejects non-lowercase emails at the database level', async () => {
    await expect(createUser({ email: 'Mixed@Example.test' })).rejects.toThrow();
  });

  it('persists factory data', async () => {
    const vehicle = await createVehicle({ make: 'Tata', model: 'Nexon', quantity: 3 });
    const found = await testPrisma().vehicle.findUnique({ where: { id: vehicle.id } });
    expect(found).toMatchObject({ make: 'Tata', model: 'Nexon', quantity: 3 });
  });

  it('starts every test with empty tables', async () => {
    expect(await testPrisma().vehicle.count()).toBe(0);
    expect(await testPrisma().user.count()).toBe(0);
  });
});
