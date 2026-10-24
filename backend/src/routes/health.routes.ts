import { Router } from 'express';
import { NotReadyError } from '../domain/errors.js';

/**
 * Two public probes. Liveness (`/health`) says the process is up and never touches the database,
 * so an orchestrator does not restart a healthy process because the database is briefly away.
 * Readiness (`/ready`) says it can serve traffic, which needs the database to answer.
 */
export function healthRoutes(pingDatabase: () => Promise<void>): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  router.get('/ready', async (_req, res) => {
    try {
      await pingDatabase();
    } catch (cause) {
      throw new NotReadyError(cause);
    }
    res.json({ status: 'ready' });
  });
  return router;
}
