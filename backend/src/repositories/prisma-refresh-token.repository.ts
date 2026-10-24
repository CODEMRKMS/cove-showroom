import type { RefreshTokenRecord } from '../domain/refresh-token.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { NewRefreshToken, RefreshTokenRepository } from './refresh-token.repository.js';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(token: NewRefreshToken): Promise<RefreshTokenRecord> {
    return this.prisma.refreshToken.create({ data: token });
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeChain(startId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      let nextId: string | null = startId;
      while (nextId) {
        const row: { revokedAt: Date | null; replacedById: string | null } | null =
          await tx.refreshToken.findUnique({ where: { id: nextId } });
        if (!row) return;
        if (!row.revokedAt) {
          await tx.refreshToken.update({ where: { id: nextId }, data: { revokedAt: new Date() } });
        }
        nextId = row.replacedById;
      }
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  rotate(currentId: string, replacement: NewRefreshToken): Promise<RefreshTokenRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      // The `revokedAt: null` guard makes retirement a compare-and-set.
      const retired = await tx.refreshToken.updateMany({
        where: { id: currentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (retired.count === 0) return null;

      const next = await tx.refreshToken.create({ data: replacement });
      await tx.refreshToken.update({ where: { id: currentId }, data: { replacedById: next.id } });
      return next;
    });
  }
}
