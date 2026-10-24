import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../../src/domain/vehicle.js';
import { Argon2PasswordHasher } from '../../src/services/password-hasher.js';
import { seedDatabase } from '../../src/seed/seed.js';
import { testPrisma } from '../helpers/db.js';
import { createUser, createVehicle } from '../helpers/factories.js';

const CONFIG = {
  admin: { email: 'owner@example.test', password: 'a-long-admin-passphrase' },
  demoUser: { email: 'buyer@example.test', password: 'a-long-buyer-passphrase' },
};

describe('seedDatabase', () => {
  describe('vehicles', () => {
    it('creates 24 vehicles, three in each of the eight categories', async () => {
      await seedDatabase(testPrisma(), CONFIG);

      const vehicles = await testPrisma().vehicle.findMany();
      expect(vehicles).toHaveLength(24);
      for (const category of CATEGORIES) {
        expect(vehicles.filter((v) => v.category === category)).toHaveLength(3);
      }
    });

    it('produces data the API itself would accept', async () => {
      await seedDatabase(testPrisma(), CONFIG);

      for (const v of await testPrisma().vehicle.findMany()) {
        expect(v.make.trim()).not.toBe('');
        expect(v.model.trim()).not.toBe('');
        expect(v.price).toBeGreaterThan(0n);
        expect(v.price).toBeLessThan(1_000_000_000_000n);
        expect(v.quantity).toBeGreaterThanOrEqual(0);
        expect(v.bodyStyle).toBe(v.category);
        expect(v.colorOptions.length).toBeGreaterThan(0);
        for (const colour of v.colorOptions) expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(v.deletedAt).toBeNull();
      }
    });

    it('marks every listing as demo data in its description', async () => {
      await seedDatabase(testPrisma(), CONFIG);

      for (const v of await testPrisma().vehicle.findMany()) {
        expect(v.description).toMatch(/^Demo listing\./);
      }
    });

    it('includes sold-out and low-stock vehicles so those UI states can be seen', async () => {
      await seedDatabase(testPrisma(), CONFIG);

      const vehicles = await testPrisma().vehicle.findMany();
      expect(vehicles.filter((v) => v.quantity === 0).length).toBeGreaterThanOrEqual(2);
      expect(
        vehicles.filter((v) => v.quantity >= 1 && v.quantity <= 3).length,
      ).toBeGreaterThanOrEqual(3);
    });

    it('records a CREATED event by the admin for each vehicle', async () => {
      await seedDatabase(testPrisma(), CONFIG);

      const admin = await testPrisma().user.findUniqueOrThrow({
        where: { email: CONFIG.admin.email },
      });
      const events = await testPrisma().inventoryEvent.findMany();
      expect(events).toHaveLength(24);
      for (const event of events) {
        expect(event).toMatchObject({ type: 'CREATED', actorId: admin.id });
        expect(event.delta).toBe(event.quantityAfter);
      }
    });
  });

  describe('accounts', () => {
    it('creates the admin with the configured password stored as an argon2id hash', async () => {
      await seedDatabase(testPrisma(), CONFIG);

      const admin = await testPrisma().user.findUniqueOrThrow({
        where: { email: CONFIG.admin.email },
      });
      expect(admin.role).toBe('ADMIN');
      expect(admin.passwordHash).toMatch(/^\$argon2id\$/);
      expect(admin.passwordHash).not.toContain(CONFIG.admin.password);
      expect(
        await new Argon2PasswordHasher().verify(admin.passwordHash, CONFIG.admin.password),
      ).toBe(true);
    });

    it('creates the demo user as a plain USER when one is configured', async () => {
      await seedDatabase(testPrisma(), CONFIG);

      const user = await testPrisma().user.findUniqueOrThrow({
        where: { email: CONFIG.demoUser.email },
      });
      expect(user.role).toBe('USER');
      expect(
        await new Argon2PasswordHasher().verify(user.passwordHash, CONFIG.demoUser.password),
      ).toBe(true);
    });

    it('creates no demo user when none is configured', async () => {
      await seedDatabase(testPrisma(), { admin: CONFIG.admin });

      expect(await testPrisma().user.count()).toBe(1);
    });

    it('promotes an already registered account to admin and sets the configured password', async () => {
      await createUser({ email: CONFIG.admin.email, role: 'USER', passwordHash: 'old-hash' });

      await seedDatabase(testPrisma(), CONFIG);

      const admins = await testPrisma().user.findMany({ where: { email: CONFIG.admin.email } });
      expect(admins).toHaveLength(1);
      expect(admins[0]?.role).toBe('ADMIN');
      expect(
        await new Argon2PasswordHasher().verify(admins[0]!.passwordHash, CONFIG.admin.password),
      ).toBe(true);
    });
  });

  describe('running it again', () => {
    it('adds nothing the second time: 24 vehicles, 24 events, one admin, one demo user', async () => {
      const first = await seedDatabase(testPrisma(), CONFIG);
      const second = await seedDatabase(testPrisma(), CONFIG);

      expect(first.vehiclesCreated).toBe(24);
      expect(second.vehiclesCreated).toBe(0);
      expect(await testPrisma().vehicle.count()).toBe(24);
      expect(await testPrisma().inventoryEvent.count()).toBe(24);
      expect(await testPrisma().user.count()).toBe(2);
    });

    it('leaves existing vehicles as they are, such as stock that has since been sold', async () => {
      await seedDatabase(testPrisma(), CONFIG);
      const sold = await testPrisma().vehicle.findFirstOrThrow({ where: { quantity: { gt: 1 } } });
      await testPrisma().vehicle.update({
        where: { id: sold.id },
        data: { quantity: 1, price: 1n },
      });

      await seedDatabase(testPrisma(), CONFIG);

      const after = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: sold.id } });
      expect(after).toMatchObject({ quantity: 1, price: 1n });
    });

    it('does not duplicate or revive a vehicle that was deleted after seeding', async () => {
      await seedDatabase(testPrisma(), CONFIG);
      const target = await testPrisma().vehicle.findFirstOrThrow();
      await testPrisma().vehicle.update({
        where: { id: target.id },
        data: { deletedAt: new Date() },
      });

      const again = await seedDatabase(testPrisma(), CONFIG);

      expect(again.vehiclesCreated).toBe(0);
      expect(await testPrisma().vehicle.count()).toBe(24);
      const stored = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: target.id } });
      expect(stored.deletedAt).not.toBeNull();
    });

    it('does not touch vehicles an admin added themselves', async () => {
      const own = await createVehicle({ make: 'Custom', model: 'One-off', quantity: 9 });

      await seedDatabase(testPrisma(), CONFIG);

      expect(await testPrisma().vehicle.count()).toBe(25);
      const stored = await testPrisma().vehicle.findUniqueOrThrow({ where: { id: own.id } });
      expect(stored.quantity).toBe(9);
    });
  });
});
