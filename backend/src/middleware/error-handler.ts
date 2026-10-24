import type { ErrorRequestHandler } from 'express';
import { AppError } from '../domain/errors.js';

const TITLES: Record<number, string> = { 400: 'Bad Request', 401: 'Unauthorized', 409: 'Conflict' };

// Maps deliberate domain errors to the JSON error body. Anything else falls
// through to Express's default 500 handler. The full envelope arrives in Phase 3.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (!(err instanceof AppError)) {
    next(err);
    return;
  }
  res.status(err.status).json({
    type: 'about:blank',
    title: TITLES[err.status] ?? 'Error',
    status: err.status,
    code: err.code,
    detail: err.message,
    ...(err.errors && { errors: err.errors }),
  });
};
