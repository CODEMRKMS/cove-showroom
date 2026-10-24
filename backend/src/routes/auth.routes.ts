import { Router, type RequestHandler } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';

export function authRoutes(controller: AuthController, loginLimiter: RequestHandler): Router {
  const router = Router();
  router.post('/register', controller.register);
  router.post('/login', loginLimiter, controller.login);
  return router;
}
