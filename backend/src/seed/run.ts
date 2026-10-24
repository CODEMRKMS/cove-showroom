import 'dotenv/config';
import { loadConfig } from '../config.js';
import { createPrismaClient } from '../infrastructure/prisma.js';
import { seedDatabase } from './seed.js';
import { loadSeedConfig } from './seed-config.js';

// Command-line entry point for `npm run db:seed`. Reads DATABASE_URL, ADMIN_EMAIL and
// ADMIN_PASSWORD (plus optional DEMO_USER_EMAIL / DEMO_USER_PASSWORD) from the environment.
const { databaseUrl } = loadConfig();
const seedConfig = loadSeedConfig();
const prisma = createPrismaClient(databaseUrl);

try {
  const { vehiclesCreated } = await seedDatabase(prisma, seedConfig);
  console.log(`Seed complete: ${vehiclesCreated} vehicle(s) added.`);
  console.log(`Admin account: ${seedConfig.admin.email}`);
  if (seedConfig.demoUser) console.log(`Demo user account: ${seedConfig.demoUser.email}`);
} finally {
  await prisma.$disconnect();
}
