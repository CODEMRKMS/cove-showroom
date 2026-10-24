import { EmailTakenError } from '../domain/errors.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { NewUser, UserRepository } from './user.repository.js';
import type { UserRecord } from '../domain/user.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(user: NewUser): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({ data: user });
    } catch (error) {
      // The unique index on email is the single source of truth, so two
      // simultaneous registrations cannot both succeed.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new EmailTakenError();
      }
      throw error;
    }
  }
}
