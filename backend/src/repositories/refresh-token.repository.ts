import type { RefreshTokenRecord } from '../domain/refresh-token.js';

export type NewRefreshToken = { userId: string; tokenHash: string; expiresAt: Date };

export interface RefreshTokenRepository {
  create(token: NewRefreshToken): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /**
   * Atomically retires `currentId` and stores its replacement.
   * @returns the replacement, or null when `currentId` was already retired
   *          (so two concurrent refreshes with one token cannot both win).
   */
  rotate(currentId: string, replacement: NewRefreshToken): Promise<RefreshTokenRecord | null>;
}
