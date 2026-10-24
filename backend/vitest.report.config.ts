import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.js';

// `npm run test:report`: the normal suite plus an HTML report, a JUnit file and an HTML coverage
// report under docs/test-report/backend. Same tests and same coverage thresholds as `npm test`.
const out = '../docs/test-report/backend';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      reporters: [
        'default',
        ['html', { outputFile: `${out}/html/index.html` }],
        ['junit', { outputFile: `${out}/junit.xml` }],
      ],
      coverage: { reportsDirectory: `${out}/coverage-report` },
    },
  }),
);
