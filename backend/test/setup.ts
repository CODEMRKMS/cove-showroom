import { afterAll, beforeEach } from 'vitest';
import { closeTestDatabase, resetDatabase } from './helpers/db.js';

// Every test starts from empty tables; each file closes its connection pool.
beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});
