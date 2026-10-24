import type { Role, UserRecord } from '../domain/user.js';

export type NewUser = {
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
};

/** Persistence contract for users. Services depend on this, not on Prisma. */
export interface UserRepository {
  create(user: NewUser): Promise<UserRecord>;
}
