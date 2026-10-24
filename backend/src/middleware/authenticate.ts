import type { RequestHandler } from 'express';
import { UnauthenticatedError } from '../domain/errors.js';
import '../http/request-context.js';
import type { AuthService } from '../services/auth.service.js';

const BEARER = /^Bearer\s+(\S+)$/i;

/** Requires a valid access token and attaches the current user to the request. */
export function createAuthenticate(auth: AuthService): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
      if (!token) throw new UnauthenticatedError();
      req.user = await auth.authenticate(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}
