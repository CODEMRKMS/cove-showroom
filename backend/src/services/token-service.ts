import jwt from 'jsonwebtoken';
import type { Config } from '../config.js';
import type { PublicUser } from '../domain/user.js';

export type AccessToken = { token: string; expiresIn: number };

export interface TokenService {
  signAccessToken(user: Pick<PublicUser, 'id' | 'role'>): AccessToken;
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
}
