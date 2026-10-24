import express, { type Express } from 'express';
import { createContainer, type AppDeps } from './container.js';
import { authRoutes } from './routes/auth.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { vehicleRoutes } from './routes/vehicle.routes.js';
import { healthRoutes } from './routes/health.routes.js';

// App factory: tests and server.ts build the app the same way, from the same
// infrastructure dependencies. Concrete wiring happens in container.ts.
export function createApp(deps: AppDeps): Express {
  const { authController, vehicleController, loginRateLimiter, authenticate } =
    createContainer(deps);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', healthRoutes());
  app.use('/api/auth', authRoutes(authController, loginRateLimiter, authenticate));
  app.use('/api/vehicles', vehicleRoutes(vehicleController, authenticate));
  app.use(errorHandler);
  return app;
}
