import express, { type Express } from 'express';
import helmet from 'helmet';
import { createContainer, type AppDeps } from './container.js';
import { authRoutes } from './routes/auth.routes.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { vehicleRoutes } from './routes/vehicle.routes.js';
import { docsRoutes } from './routes/docs.routes.js';
import { healthRoutes } from './routes/health.routes.js';

// App factory: tests and server.ts build the app the same way, from the same
// infrastructure dependencies. Concrete wiring happens in container.ts.
export function createApp(deps: AppDeps): Express {
  const {
    authController,
    vehicleController,
    inventoryController,
    orderController,
    adminController,
    loginRateLimiter,
    authenticate,
    pingDatabase,
  } = createContainer(deps);
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', healthRoutes(pingDatabase));
  app.use('/api', docsRoutes());
  app.use('/api/auth', authRoutes(authController, loginRateLimiter, authenticate));
  app.use('/api/vehicles', vehicleRoutes(vehicleController, authenticate));
  app.use('/api/vehicles', inventoryRoutes(inventoryController, authenticate));
  app.use('/api/orders', orderRoutes(orderController, authenticate));
  app.use('/api/admin', adminRoutes(adminController, authenticate));
  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger ?? console));
  return app;
}
