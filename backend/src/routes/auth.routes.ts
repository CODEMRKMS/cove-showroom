import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';

export function authRoutes(controller: AuthController): Router {
  const router = Router();
  router.post('/register', controller.register);
  router.post('/login', controller.login);
  return router;
}
