import type { Server } from 'node:http';

type ShutdownLog = { info(message: string): void; error(message: string): void };

type ShutdownOptions = {
  server: Server;
  /** Runs after the server has stopped, e.g. closing the database pool. */
  cleanup: () => Promise<void>;
  log: ShutdownLog;
  /** How long requests in flight get before their sockets are cut. */
  timeoutMs?: number;
};

/**
 * Returns the function that stops the process cleanly: refuse new connections, let requests in
 * flight finish (up to the timeout, then cut them), run the cleanup. Calling it again returns the
 * same promise, so two signals in a row cannot close the database twice.
 */
export function createShutdown({
  server,
  cleanup,
  log,
  timeoutMs = 10_000,
}: ShutdownOptions): () => Promise<void> {
  let running: Promise<void> | undefined;

  const stop = async (): Promise<void> => {
    log.info('Shutting down: no new connections, finishing requests in flight');
    const closed = new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    const timer = setTimeout(() => {
      log.error(`Shutdown timed out after ${timeoutMs} ms, forcing open connections closed`);
      server.closeAllConnections();
    }, timeoutMs);
    try {
      await closed;
    } finally {
      clearTimeout(timer);
    }
    await cleanup();
    log.info('Shutdown complete');
  };

  return () => {
    running ??= stop().catch((error: unknown) => {
      log.error(`Shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    });
    return running;
  };
}

type SignalSource = { on(signal: string, listener: () => void): unknown };

/** Wires SIGTERM (orchestrators) and SIGINT (Ctrl+C) to the shutdown, then ends the process. */
export function handleSignals(
  source: SignalSource,
  shutdown: () => Promise<void>,
  exit: (code: number) => void,
  log: ShutdownLog,
): void {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    source.on(signal, () => {
      log.info(`Received ${signal}`);
      shutdown().then(
        () => exit(0),
        () => exit(1),
      );
    });
  }
}
