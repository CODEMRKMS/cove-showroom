import express, { type Express } from 'express';
import { createContainer, type AppDeps } from './container.js';
import { authRoutes } from './routes/auth.routes.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { vehicleRoutes } from './routes/vehicle.routes.js';
import { healthRoutes } from './routes/health.routes.js';

// App factory: tests and server.ts build the app the same way, from the same
// infrastructure dependencies. Concrete wiring happens in container.ts.
export function createApp(deps: AppDeps): Express {
  const {
    authController,
    vehicleController,
    inventoryController,
    loginRateLimiter,
    authenticate,
    pingDatabase,
  } = createContainer(deps);
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', healthRoutes(pingDatabase));
  app.use('/api/auth', authRoutes(authController, loginRateLimiter, authenticate));
  app.use('/api/vehicles', vehicleRoutes(vehicleController, authenticate));
  app.use('/api/vehicles', inventoryRoutes(inventoryController, authenticate));
  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger ?? console));
  return app;
}
