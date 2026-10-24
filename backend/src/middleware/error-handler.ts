import { STATUS_CODES } from 'node:http';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, RouteNotFoundError, type FieldError } from '../domain/errors.js';
import '../http/request-context.js';

/** Where unexpected failures are recorded. The default is the console; tests pass a spy. */
export type ErrorLogger = {
  error(
    message: string,
    context: { requestId: string; method: string; path: string; error: unknown },
  ): void;
};

type Problem = { status: number; code: string; detail: string; errors?: FieldError[] };

const INTERNAL: Problem = {
  status: 500,
  code: 'INTERNAL_ERROR',
  detail: 'Something went wrong on our side. Quote the request id if you report it.',
};

// Errors raised by Express's body parser carry an HTTP status and a machine-readable `type`.
const isFrameworkClientError = (err: unknown): err is { status: number; type: string } =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  typeof err.status === 'number' &&
  err.status >= 400 &&
  err.status < 500 &&
  'type' in err &&
  typeof err.type === 'string';

/**
 * Decides what the client is told. Deliberate AppErrors speak for themselves; known framework
 * errors get a fixed message; anything else is a 500 whose real cause stays in the server log.
 */
function toProblem(err: unknown): Problem {
  if (err instanceof AppError) {
    return {
      status: err.status,
      code: err.code,
      detail: err.message,
      ...(err.errors && { errors: err.errors }),
    };
  }
  if (isFrameworkClientError(err)) {
    if (err.type === 'entity.parse.failed') {
      return { status: 400, code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' };
    }
    if (err.type === 'entity.too.large') {
      return { status: 413, code: 'PAYLOAD_TOO_LARGE', detail: 'The request body is too large.' };
    }
    return {
      status: err.status,
      code: 'BAD_REQUEST',
      detail: 'The request could not be processed.',
    };
  }
  return INTERNAL;
}

/** Any request that reached the end of the route table. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new RouteNotFoundError());
};

/** The one place errors become responses: an RFC 7807 style body with the request id, never a stack. */
export function createErrorHandler(logger: ErrorLogger): ErrorRequestHandler {
  return (err, req, res, next) => {
    const problem = toProblem(err);
    if (problem.status >= 500) {
      logger.error('Unhandled error', {
        // pino-http widens the global req.id type; the requestId middleware always sets a string.
        requestId: String(req.id),
        method: req.method,
        path: req.path,
        error: err,
      });
    }
    // Too late to send an error body: let Express close the connection.
    if (res.headersSent) {
      next(err);
      return;
    }
    if (problem.status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(problem.status).json({
      type: 'about:blank',
      title: STATUS_CODES[problem.status] ?? 'Error',
      status: problem.status,
      code: problem.code,
      detail: problem.detail,
      requestId: req.id,
      ...(problem.errors && { errors: problem.errors }),
    });
  };
}
