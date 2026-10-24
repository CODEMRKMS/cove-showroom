import 'dotenv/config';
import { createApp } from './app.js';

// Bootstrap only. Validated config and graceful shutdown arrive with the
// config module (Phase 2).
const port = Number(process.env['PORT'] ?? 3000);
const server = createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

process.on('SIGTERM', () => server.close());
