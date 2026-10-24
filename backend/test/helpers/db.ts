import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createPrismaClient } from '../../src/infrastructure/prisma.js';
import { getTestDatabaseUrl } from './test-database.js';

let client: PrismaClient | undefined;

/** Shared Prisma client bound to the test database. */
export function testPrisma(): PrismaClient {
  client ??= createPrismaClient(getTestDatabaseUrl());
  return client;
}

/** Empty every application table (keeps the migrations table). */
export async function resetDatabase(): Promise<void> {
  const prisma = testPrisma();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function closeTestDatabase(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
