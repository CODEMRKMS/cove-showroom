import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import '../http/request-context.js';

// Short, plain characters only: the id is echoed in a header and in JSON, so nothing a caller sends
// that could break either (spaces, markup, control characters, huge strings) is ever kept.
const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Gives every request an id, reusing a well-formed one from the caller so a request can be traced across services. */
export const requestId: RequestHandler = (req, res, next) => {
  const sent = req.headers['x-request-id'];
  req.id = typeof sent === 'string' && SAFE_ID.test(sent) ? sent : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
