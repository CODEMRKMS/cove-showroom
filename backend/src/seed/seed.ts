import type { PrismaClient } from '../generated/prisma/client.js';
import { Argon2PasswordHasher, type PasswordHasher } from '../services/password-hasher.js';
import { DEMO_VEHICLES } from './demo-vehicles.js';
import type { SeedConfig } from './seed-config.js';

export type SeedSummary = { vehiclesCreated: number };

/**
 * Loads the demo catalogue and the admin (and optional demo user) accounts. Safe to run repeatedly.
 *
 * This is a bootstrap script, so it talks to Prisma directly instead of going through the
 * repositories that serve requests. It is the only way to create an admin: public registration
 * can only ever create a USER.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  config: SeedConfig,
  hasher: PasswordHasher = new Argon2PasswordHasher(),
): Promise<SeedSummary> {
  const adminHash = await hasher.hash(config.admin.password);
  const demoUserHash = config.demoUser && (await hasher.hash(config.demoUser.password));

  return prisma.$transaction(async (tx) => {
    // An existing account with this email is promoted and its password set to the configured one,
    // so re-running the seed with a new ADMIN_PASSWORD rotates it.
    const admin = await tx.user.upsert({
      where: { email: config.admin.email },
      create: {
        email: config.admin.email,
        name: 'Showroom Admin',
        role: 'ADMIN',
        passwordHash: adminHash,
      },
      update: { role: 'ADMIN', passwordHash: adminHash },
    });

    if (config.demoUser && demoUserHash) {
      await tx.user.upsert({
        where: { email: config.demoUser.email },
        create: {
          email: config.demoUser.email,
          name: 'Demo Buyer',
          role: 'USER',
          passwordHash: demoUserHash,
        },
        update: {}, // leave an existing account exactly as it is
      });
    }

    let vehiclesCreated = 0;
    for (const demo of DEMO_VEHICLES) {
      // Match on make and model whether or not the row was soft-deleted, so a vehicle an admin
      // removed is not brought back, and one they changed is not overwritten.
      const existing = await tx.vehicle.findFirst({
        where: { make: demo.make, model: demo.model },
        select: { id: true },
      });
      if (existing) continue;

      const vehicle = await tx.vehicle.create({
        data: {
          make: demo.make,
          model: demo.model,
          category: demo.category,
          bodyStyle: demo.category,
          price: BigInt(demo.priceRupees) * 100n,
          quantity: demo.quantity,
          year: demo.year,
          colorOptions: demo.colorOptions,
          description: `Demo listing. ${demo.note} Price and stock are sample data, not a real offer.`,
        },
      });
      await tx.inventoryEvent.create({
        data: {
          vehicleId: vehicle.id,
          actorId: admin.id,
          type: 'CREATED',
          delta: vehicle.quantity,
          quantityAfter: vehicle.quantity,
        },
      });
      vehiclesCreated += 1;
    }
    return { vehiclesCreated };
  });
}
