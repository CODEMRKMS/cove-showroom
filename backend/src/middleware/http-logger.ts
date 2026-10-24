import type { Request, RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import type { ErrorLogger } from './error-handler.js';
import type { Logger } from '../infrastructure/logger.js';
import '../http/request-context.js';

// Orchestrators poll these every few seconds; logging them would bury real traffic.
const PROBES = new Set(['/api/health', '/api/ready']);

/** One access-log line per request, tied to the id the requestId middleware already set. */
export function createHttpLogger(log: Logger): RequestHandler {
  return pinoHttp({
    logger: log,
    genReqId: (req) => (req as Request).id,
    autoLogging: { ignore: (req) => PROBES.has((req.url ?? '').split('?')[0]!) },
    // For a 5xx pino-http would attach an invented Error whose stack points inside pino-http. The real
    // error, with its real stack, is logged by the error handler under the same request id.
    serializers: { err: () => undefined },
    customErrorMessage: () => 'request completed',
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  });
}

/** Sends the error handler's records to pino, with the Error under `err` so pino writes its stack. */
export function pinoErrorLogger(log: Logger): ErrorLogger {
  return {
    error(message, { error, ...context }) {
      log.error({ ...context, err: error }, message);
    },
  };
}
