import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { loadConfig, type Config } from '../../src/config.js';
import { testPrisma } from './db.js';
import { getTestDatabaseUrl } from './test-database.js';

export const TEST_JWT_SECRET = 'test-secret-that-is-comfortably-longer-than-32-chars';

/** Config for tests: real test database URL, fixed JWT secret. */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: getTestDatabaseUrl(),
    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    // Tests that switch NODE_ENV (cookie flags) would otherwise print access logs; logging tests capture their own.
    LOG_LEVEL: 'silent',
    ...overrides,
  });
}

/** A fully wired app bound to the real test database. */
export function buildTestApp(config: Config = testConfig()): Express {
  return createApp({ config, prisma: testPrisma() });
}
