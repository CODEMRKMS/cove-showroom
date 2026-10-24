import { toPublicUser, type PublicUser } from '../domain/user.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { PasswordHasher } from './password-hasher.js';
import type { TokenService } from './token-service.js';

export type RegisterInput = { email: string; password: string; name: string };

export type LoginInput = { email: string; password: string };

export type LoginResult = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
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
    // Failure handling is refined in the next cycle; until then it denies with a generic error.
    if (!user || !(await this.hasher.verify(user.passwordHash, input.password))) {
      throw new Error('Invalid credentials');
    }
    const publicUser = toPublicUser(user);
    const { token, expiresIn } = this.tokens.signAccessToken(publicUser);
    return { accessToken: token, tokenType: 'Bearer', expiresIn, user: publicUser };
  }
}
