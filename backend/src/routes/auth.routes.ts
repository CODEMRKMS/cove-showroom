import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';

export function authRoutes(controller: AuthController): Router {
  const router = Router();
  router.post('/register', controller.register);
  return router;
}
