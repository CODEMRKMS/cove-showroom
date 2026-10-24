import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Integration tests share ONE real PostgreSQL database (DATABASE_URL_TEST), so
// files must run one after another. Tables are truncated between tests.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Not counted: bootstrap, generated client, config/seed (nothing to unit test).
      exclude: ['src/server.ts', 'src/generated/**', 'prisma/**'],
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      // Fail the run under 90% for the layers that hold the rules. Middleware joins
      // once the error envelope lands (Phase 3, item 17) and its last branches are covered.
      thresholds: {
        'src/services/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/controllers/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
  },
});
