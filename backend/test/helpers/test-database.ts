// Single place that decides which database tests may touch.

export function getTestDatabaseUrl(): string {
  const url = process.env['DATABASE_URL_TEST'];
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Copy backend/.env.example to backend/.env and fill it in.',
    );
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  // Tests TRUNCATE every table. Refuse anything that does not look like a test DB.
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against "${dbName}": database name must end with _test.`,
    );
  }
  return url;
}
