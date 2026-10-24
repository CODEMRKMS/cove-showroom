import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createShutdown, handleSignals } from './http/graceful-shutdown.js';
import { createLogger } from './infrastructure/logger.js';
import { createPrismaClient } from './infrastructure/prisma.js';

// Bootstrap only: read config, build the app, listen, and stop cleanly on SIGTERM / SIGINT.
const config = loadConfig();
const log = createLogger(config.logLevel);
const prisma = createPrismaClient(config.databaseUrl);
const server = createApp({ config, prisma, log }).listen(config.port, () => {
  log.info(`API listening on http://localhost:${config.port}`);
});

const shutdown = createShutdown({ server, cleanup: () => prisma.$disconnect(), log });
handleSignals(process, shutdown, (code) => process.exit(code), log);
