import type { PublicUser } from '../domain/user.js';

declare global {
  // Express exposes its Request type only through this global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set first by the requestId middleware; echoed in X-Request-Id and every error body. */
      id: string;
      /** Set by the authenticate middleware from the database, never from token claims. */
      user?: PublicUser;
    }
  }
}
