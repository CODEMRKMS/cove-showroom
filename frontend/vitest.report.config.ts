import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vite.config.js';

// `npm run test:report`: the normal suite plus an HTML report, a JUnit file and an HTML coverage
// report under docs/test-report/frontend. Same tests and same coverage settings as `npm test`.
const out = '../docs/test-report/frontend';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      reporters: [
        'default',
        ['html', { outputDir: `${out}/html`, singleFile: true }],
        ['junit', { outputFile: `${out}/junit.xml` }],
      ],
      coverage: { reportsDirectory: `${out}/coverage-report` },
    },
  }),
);
