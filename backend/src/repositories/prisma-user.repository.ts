import type { PrismaClient } from '../generated/prisma/client.js';
import type { NewUser, UserRepository } from './user.repository.js';
import type { UserRecord } from '../domain/user.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(user: NewUser): Promise<UserRecord> {
    return this.prisma.user.create({ data: user });
  }
}
