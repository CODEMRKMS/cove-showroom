import { Router, type RequestHandler } from 'express';
import type { InventoryController } from '../controllers/inventory.controller.js';
import { authorize } from '../middleware/authorize.js';

/** Stock-changing actions on a vehicle. Mounted at /api/vehicles next to the CRUD routes. */
export function inventoryRoutes(
  controller: InventoryController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.post(
    '/:id/purchase',
    authenticate,
    authorize('POST /api/vehicles/:id/purchase'),
    controller.purchase,
  );
  return router;
}
