import { pino, type DestinationStream, type Logger } from 'pino';

export type { Logger };

// Values that must never reach a log file: the access token, the refresh cookie sent by the
// browser, and the refresh cookie the server sets on login and refresh.
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

/** The one pino instance, JSON lines to stdout (or `destination`), with secrets redacted. */
export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino({ level, redact: { paths: REDACTED_PATHS, censor: '[Redacted]' } }, destination);
}
