import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrismaClient } from './infrastructure/prisma.js';

// Bootstrap only. Graceful shutdown arrives with the hardening work.
const config = loadConfig();
const prisma = createPrismaClient(config.databaseUrl);
const server = createApp({ config, prisma }).listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

process.on('SIGTERM', () => {
  server.close();
  void prisma.$disconnect();
});
