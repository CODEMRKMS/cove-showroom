import { Writable } from 'node:stream';
import { createLogger } from '../../src/infrastructure/logger.js';

type LogLine = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A real pino logger (same redaction rules as production) whose output is kept in memory. */
export function captureLogs(level = 'info') {
  let raw = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      raw += chunk.toString();
      done();
    },
  });
  return {
    log: createLogger(level, stream),
    /** Everything written so far, exactly as it would reach a log file. */
    raw: () => raw,
    lines: (): LogLine[] =>
      raw
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LogLine),
  };
}
