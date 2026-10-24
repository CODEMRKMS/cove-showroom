import { InvalidCredentialsError, UnauthenticatedError } from '../domain/errors.js';
import { toPublicUser, type PublicUser } from '../domain/user.js';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { PasswordHasher } from './password-hasher.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';
import type { TokenService } from './token-service.js';

// A real argon2id hash of a throwaway password. Verifying against it when the
// email is unknown makes that path cost the same as a wrong password.
// Regenerate it if the hashing parameters ever change.
const PLACEHOLDER_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$gFifOKvU2PpxEbgOhE8Khg$tlUB2viu+onEEaSjjJIo9gQwCqEVadhCeHErGAewgXo';

export type RegisterInput = { email: string; password: string; name: string };

export type LoginInput = { email: string; password: string };

/** What a client needs to continue a session. `refreshToken` goes in a cookie, never the body. */
export type Session = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
};

export type LoginResult = Session & { user: PublicUser };

export type AuthServiceOptions = { refreshTtlSeconds: number };

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly options: AuthServiceOptions,
  ) {}

  /** Public registration always creates a USER; the role is never an input. */
  async register(input: RegisterInput): Promise<PublicUser> {
    const user = await this.users.create({
      email: input.email.trim().toLowerCase(),
      passwordHash: await this.hasher.hash(input.password),
      name: input.name.trim(),
      role: 'USER',
    });
    return toPublicUser(user);
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email.trim().toLowerCase());
    const passwordMatches = await this.hasher.verify(
      user?.passwordHash ?? PLACEHOLDER_HASH,
      input.password,
    );
    // Same error for an unknown email and a wrong password.
    if (!user || !passwordMatches) throw new InvalidCredentialsError();
    const publicUser = toPublicUser(user);
    const refreshToken = generateRefreshToken();
    await this.refreshTokens.create(this.newRefreshRow(user.id, refreshToken));
    return { ...this.startSession(publicUser, refreshToken), user: publicUser };
  }

  /** Swaps a valid refresh token for a new session; the old token can never be used again. */
  async refresh(presentedToken: string | undefined): Promise<Session> {
    if (!presentedToken) throw new UnauthenticatedError();
    const current = await this.refreshTokens.findByHash(hashRefreshToken(presentedToken));
    const user = current && (await this.users.findById(current.userId));
    if (!current || !user) throw new UnauthenticatedError();

    const nextToken = generateRefreshToken();
    const rotated = await this.refreshTokens.rotate(
      current.id,
      this.newRefreshRow(user.id, nextToken),
    );
    if (!rotated) throw new UnauthenticatedError();
    return this.startSession(toPublicUser(user), nextToken);
  }

  private newRefreshRow(userId: string, token: string) {
    return {
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + this.options.refreshTtlSeconds * 1000),
    };
  }

  private startSession(user: PublicUser, refreshToken: string): Session {
    const { token, expiresIn } = this.tokens.signAccessToken(user);
    return { accessToken: token, tokenType: 'Bearer', expiresIn, refreshToken };
  }

  /** Resolves an access token to the current user. The role always comes from the database. */
  async authenticate(accessToken: string): Promise<PublicUser> {
    const user = await this.users.findById(this.tokens.verifyAccessToken(accessToken));
    if (!user) throw new UnauthenticatedError();
    return toPublicUser(user);
  }
}
