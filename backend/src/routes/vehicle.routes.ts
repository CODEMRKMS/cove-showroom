import { Router, type RequestHandler } from 'express';
import type { VehicleController } from '../controllers/vehicle.controller.js';
import { authorize } from '../middleware/authorize.js';

/** Every route runs authenticate, then the policy check for its own "METHOD path" key. */
export function vehicleRoutes(controller: VehicleController, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/', authenticate, authorize('GET /api/vehicles'), controller.list);
  router.post('/', authenticate, authorize('POST /api/vehicles'), controller.create);
  return router;
}
