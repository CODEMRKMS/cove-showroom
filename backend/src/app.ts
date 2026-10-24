import express, { type Express } from 'express';
import { healthRoutes } from './routes/health.routes.js';

// App factory: tests build an isolated app, production builds one in server.ts.
// Dependencies (services, config) are injected here once they exist (Phase 2).
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', healthRoutes());
  return app;
}
