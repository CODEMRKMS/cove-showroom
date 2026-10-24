import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getTestDatabaseUrl } from './helpers/test-database.js';

// Runs once before the suite: bring the test database to the latest migration.
export default function setup(): void {
  const url = getTestDatabaseUrl();
  const prismaCli = fileURLToPath(
    new URL('../node_modules/prisma/build/index.js', import.meta.url),
  );
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    // prisma.config.ts reads DATABASE_URL; dotenv will not override it.
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
