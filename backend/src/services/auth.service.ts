import { toPublicUser, type PublicUser } from '../domain/user.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { PasswordHasher } from './password-hasher.js';

export type RegisterInput = { email: string; password: string; name: string };

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
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
}
