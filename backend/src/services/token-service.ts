import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../domain/errors.js';
import type { Config } from '../config.js';
import type { PublicUser } from '../domain/user.js';

export type AccessToken = { token: string; expiresIn: number };

export interface TokenService {
  signAccessToken(user: Pick<PublicUser, 'id' | 'role'>): AccessToken;
  /** @returns the user id (`sub`) of a valid token. @throws UnauthenticatedError otherwise. */
  verifyAccessToken(token: string): string;
}

/** HS256 access tokens. The algorithm is always explicit, never taken from the token. */
export class JwtTokenService implements TokenService {
  constructor(private readonly options: Config['jwt']) {}

  signAccessToken(user: Pick<PublicUser, 'id' | 'role'>): AccessToken {
    const token = jwt.sign({ role: user.role }, this.options.accessSecret, {
      algorithm: 'HS256',
      subject: user.id,
      issuer: this.options.issuer,
      audience: this.options.audience,
      expiresIn: this.options.accessTtlSeconds,
    });
    return { token, expiresIn: this.options.accessTtlSeconds };
  }

  verifyAccessToken(token: string): string {
    try {
      // Pinning `algorithms` stops "alg: none" and algorithm-confusion tokens.
      const claims = jwt.verify(token, this.options.accessSecret, {
        algorithms: ['HS256'],
        issuer: this.options.issuer,
        audience: this.options.audience,
      });
      if (typeof claims === 'object' && typeof claims.sub === 'string') return claims.sub;
    } catch {
      // Fall through: every failure looks the same to the caller.
    }
    throw new UnauthenticatedError();
  }
}
