import { describe, expect, it, vi } from 'vitest';
import type { RefreshTokenRecord } from '../../src/domain/refresh-token.js';
import type { UserRecord } from '../../src/domain/user.js';
import type { RefreshTokenRepository } from '../../src/repositories/refresh-token.repository.js';
import type { UserRepository } from '../../src/repositories/user.repository.js';
import { AuthService } from '../../src/services/auth.service.js';
import type { PasswordHasher } from '../../src/services/password-hasher.js';
import type { TokenService } from '../../src/services/token-service.js';

const user: UserRecord = {
  id: 'user-1',
  email: 'lena@example.com',
  passwordHash: 'hash',
  name: 'Lena',
  role: 'USER',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const activeToken: RefreshTokenRecord = {
  id: 'token-1',
  userId: user.id,
  tokenHash: 'hash-of-token',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
  replacedById: null,
  createdAt: new Date(),
};

describe('AuthService.refresh: losing a rotation race', () => {
  it('treats it as token reuse: revokes all of the user’s tokens and answers 401', async () => {
    const refreshTokens: RefreshTokenRepository = {
      create: vi.fn(),
      findByHash: vi.fn().mockResolvedValue(activeToken),
      rotate: vi.fn().mockResolvedValue(null), // another request retired it first
      revokeAllForUser: vi.fn(),
      revokeChain: vi.fn(),
    };
    const users: UserRepository = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(user),
      findByEmail: vi.fn(),
    };
    const hasher: PasswordHasher = { hash: vi.fn(), verify: vi.fn() };
    const tokens: TokenService = { signAccessToken: vi.fn(), verifyAccessToken: vi.fn() };
    const service = new AuthService(users, refreshTokens, hasher, tokens, {
      refreshTtlSeconds: 60,
    });

    await expect(service.refresh('any-presented-token')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });

    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(user.id);
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
  });
});
