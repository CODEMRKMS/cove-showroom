import { setupServer } from 'msw/node';

/** One MSW server for the whole test run; each test adds its own handlers with server.use(). */
export const server = setupServer();
