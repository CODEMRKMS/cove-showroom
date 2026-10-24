import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection string here, not in schema.prisma.
// dotenv never overrides variables that are already set, so callers (the test
// global setup) can point the CLI at another database by setting DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
