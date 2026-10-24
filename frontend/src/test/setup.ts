import '@testing-library/jest-dom/vitest';
import { server } from './server';

// Node's fetch needs absolute URLs, but the app calls relative /api paths like the browser does.
const nodeFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  typeof input === 'string' && input.startsWith('/')
    ? nodeFetch(new URL(input, window.location.origin), init)
    : nodeFetch(input, init);

// A request nobody mocked is a test bug, so fail loudly instead of reaching the network.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
