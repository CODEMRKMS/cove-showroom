import { Router, type RequestHandler } from 'express';
import type { VehicleController } from '../controllers/vehicle.controller.js';
import { authorize } from '../middleware/authorize.js';

/** Every route runs authenticate, then the policy check for its own "METHOD path" key. */
export function vehicleRoutes(controller: VehicleController, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/', authenticate, authorize('GET /api/vehicles'), controller.list);
  // Registered before '/:id' so "search" is not read as a vehicle id.
  router.get('/search', authenticate, authorize('GET /api/vehicles/search'), controller.search);
  router.get('/:id', authenticate, authorize('GET /api/vehicles/:id'), controller.get);
  router.put('/:id', authenticate, authorize('PUT /api/vehicles/:id'), controller.update);
  router.delete('/:id', authenticate, authorize('DELETE /api/vehicles/:id'), controller.delete);
  router.post('/', authenticate, authorize('POST /api/vehicles'), controller.create);
  return router;
}
