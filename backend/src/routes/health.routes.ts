import { Router } from 'express';

// Liveness probe: no auth, no database. Readiness (DB ping) comes in Phase 3.
export function healthRoutes(): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  return router;
}
