import { Router, type RequestHandler } from 'express';
import type { AdminController } from '../controllers/admin.controller.js';
import { authorize } from '../middleware/authorize.js';

export function adminRoutes(controller: AdminController, authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/events', authenticate, authorize('GET /api/admin/events'), controller.events);
  return router;
}
