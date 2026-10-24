import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createErrorHandler, notFoundHandler } from '../../src/middleware/error-handler.js';
import { requestId } from '../../src/middleware/request-id.js';

function appThatThrows(thrown: unknown, logger = { error: vi.fn() }) {
  const app = express();
  app.use(requestId);
  app.get('/boom', () => {
    throw thrown;
  });
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return { app, logger };
}

describe('createErrorHandler', () => {
  it('answers 500 for something that is not an Error at all, and logs it', async () => {
    const { app, logger } = appThatThrows('a bare string was thrown');

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toContain('bare string');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]![1].error).toBe('a bare string was thrown');
  });

  it('hands the error on instead of writing a second response when headers are already sent', () => {
    const logger = { error: vi.fn() };
    const handler = createErrorHandler(logger);
    const error = new Error('failed halfway through a response');
    const res = { headersSent: true, status: vi.fn(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    handler(error, { id: 'r1' } as Request, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('notFoundHandler', () => {
  it('answers 404 ROUTE_NOT_FOUND without repeating the requested path', async () => {
    const { app } = appThatThrows(new Error('unused'));

    const res = await request(app).get('/some/<b>path</b>');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    expect(res.text).not.toContain('<b>');
  });
});
