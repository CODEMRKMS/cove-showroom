import type { Config } from './config.js';
import { AuthController } from './controllers/auth.controller.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { PrismaUserRepository } from './repositories/prisma-user.repository.js';
import { AuthService } from './services/auth.service.js';
import { Argon2PasswordHasher } from './services/password-hasher.js';

export type AppDeps = { config: Config; prisma: PrismaClient };

/** Composition root: the only place concrete classes are chosen and wired. */
export function createContainer({ prisma }: AppDeps) {
  const users = new PrismaUserRepository(prisma);
  const authService = new AuthService(users, new Argon2PasswordHasher());
  return { authController: new AuthController(authService) };
}
