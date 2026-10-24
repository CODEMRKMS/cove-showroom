import { Router, type RequestHandler } from 'express';
import type { OrderController } from '../controllers/order.controller.js';
import { authorize } from '../middleware/authorize.js';

export function orderRoutes(controller: OrderController, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/mine', authenticate, authorize('GET /api/orders/mine'), controller.mine);
  return router;
}
