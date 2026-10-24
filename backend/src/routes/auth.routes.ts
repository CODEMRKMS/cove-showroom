import { Router, type RequestHandler } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';

export function authRoutes(
  controller: AuthController,
  loginLimiter: RequestHandler,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.post('/register', controller.register);
  router.post('/login', loginLimiter, controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);
  return router;
}
