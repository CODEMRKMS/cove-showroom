import { describe, expect, it, vi } from 'vitest';
import type { RefreshTokenRepository } from '../../src/repositories/refresh-token.repository.js';
import type { UserRepository } from '../../src/repositories/user.repository.js';
import { AuthService } from '../../src/services/auth.service.js';
import type { PasswordHasher } from '../../src/services/password-hasher.js';
import type { TokenService } from '../../src/services/token-service.js';

function buildService() {
  const users: UserRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn().mockResolvedValue(null),
  };
  const refreshTokens: RefreshTokenRepository = {
    create: vi.fn(),
    findByHash: vi.fn(),
    rotate: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  const hasher: PasswordHasher = {
    hash: vi.fn(),
    verify: vi.fn().mockResolvedValue(false),
  };
  const tokens: TokenService = { signAccessToken: vi.fn(), verifyAccessToken: vi.fn() };
  return {
    service: new AuthService(users, refreshTokens, hasher, tokens, { refreshTtlSeconds: 60 }),
    hasher,
  };
}

describe('AuthService.login', () => {
  it('still performs one password verification when the email is unknown, so timing does not reveal which emails exist', async () => {
    const { service, hasher } = buildService();

    await expect(
      service.login({ email: 'nobody@example.com', password: 'whatever-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(hasher.verify).toHaveBeenCalledTimes(1);
  });
});
