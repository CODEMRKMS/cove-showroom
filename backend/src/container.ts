import type { Config } from './config.js';
import type { ErrorLogger } from './middleware/error-handler.js';
import { createAuthenticate } from './middleware/authenticate.js';
import { createLoginRateLimiter } from './middleware/rate-limit.js';
import { AuthController } from './controllers/auth.controller.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { PrismaRefreshTokenRepository } from './repositories/prisma-refresh-token.repository.js';
import { PrismaUserRepository } from './repositories/prisma-user.repository.js';
import { AuthService } from './services/auth.service.js';
import { Argon2PasswordHasher } from './services/password-hasher.js';
import { JwtTokenService } from './services/token-service.js';
import { VehicleService } from './services/vehicle.service.js';
import { InventoryService } from './services/inventory.service.js';
import { InventoryController } from './controllers/inventory.controller.js';
import { PrismaInventoryRepository } from './repositories/prisma-inventory.repository.js';
import { VehicleController } from './controllers/vehicle.controller.js';
import { PrismaVehicleRepository } from './repositories/prisma-vehicle.repository.js';

export type AppDeps = {
  config: Config;
  prisma: PrismaClient;
  /** Where unexpected errors are recorded. Defaults to the console. */
  logger?: ErrorLogger;
};

/** Composition root: the only place concrete classes are chosen and wired. */
export function createContainer({ config, prisma }: AppDeps) {
  const users = new PrismaUserRepository(prisma);
  const authService = new AuthService(
    users,
    new PrismaRefreshTokenRepository(prisma),
    new Argon2PasswordHasher(),
    new JwtTokenService(config.jwt),
    { refreshTtlSeconds: config.refreshTtlSeconds },
  );
  const vehicleService = new VehicleService(new PrismaVehicleRepository(prisma));
  const inventoryService = new InventoryService(new PrismaInventoryRepository(prisma));
  return {
    pingDatabase: async (): Promise<void> => {
      await prisma.$queryRaw`SELECT 1`;
    },
    vehicleController: new VehicleController(vehicleService),
    inventoryController: new InventoryController(inventoryService),
    authController: new AuthController(authService, {
      secure: config.nodeEnv === 'production',
      maxAgeMs: config.refreshTtlSeconds * 1000,
    }),
    authenticate: createAuthenticate(authService),
    loginRateLimiter: createLoginRateLimiter(config.authRateLimit),
  };
}
