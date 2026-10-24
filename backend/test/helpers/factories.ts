import type { Role, Category, BodyStyle } from '../../src/generated/prisma/client.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { testPrisma } from './db.js';

let sequence = 0;
const next = (): number => ++sequence;

type UserOverrides = { email?: string; name?: string; role?: Role; passwordHash?: string };

/** Persist a user. The default hash is a placeholder: use the auth service to test real login. */
export async function createUser(
  overrides: UserOverrides = {},
  prisma: PrismaClient = testPrisma(),
) {
  const n = next();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${n}@example.test`,
      name: overrides.name ?? `Test User ${n}`,
      role: overrides.role ?? 'USER',
      passwordHash: overrides.passwordHash ?? 'not-a-real-hash',
    },
  });
}

type VehicleOverrides = {
  make?: string;
  model?: string;
  category?: Category;
  bodyStyle?: BodyStyle;
  price?: bigint;
  quantity?: number;
  year?: number;
  deletedAt?: Date | null;
  createdAt?: Date;
};

/** Persist a vehicle with sensible defaults. Price is in minor units (paise). */
export async function createVehicle(
  overrides: VehicleOverrides = {},
  prisma: PrismaClient = testPrisma(),
) {
  const n = next();
  const category = overrides.category ?? 'SEDAN';
  return prisma.vehicle.create({
    data: {
      make: overrides.make ?? `Make${n}`,
      model: overrides.model ?? `Model${n}`,
      category,
      bodyStyle: overrides.bodyStyle ?? category,
      price: overrides.price ?? 1_500_000_00n,
      quantity: overrides.quantity ?? 5,
      year: overrides.year ?? 2024,
      colorOptions: ['#1F5FBF', '#B42318'],
      deletedAt: overrides.deletedAt ?? null,
      ...(overrides.createdAt && { createdAt: overrides.createdAt }),
    },
  });
}
