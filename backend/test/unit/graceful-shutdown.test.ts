import { EventEmitter } from 'node:events';
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShutdown, handleSignals } from '../../src/http/graceful-shutdown.js';

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.closeAllConnections();
});

async function listen(handler: Parameters<typeof createServer>[1]): Promise<Server> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

const portOf = (server: Server) => (server.address() as AddressInfo).port;
const quietLog = () => ({ info: vi.fn(), error: vi.fn() });

function get(port: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    httpRequest({ host: '127.0.0.1', port, path: '/', agent: false }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => (body += chunk.toString()));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    })
      .on('error', reject)
      .end();
  });
}

describe('createShutdown', () => {
  it('stops accepting connections, then runs the cleanup', async () => {
    const server = await listen((_req, res) => res.end('ok'));
    const port = portOf(server);
    const order: string[] = [];
    const shutdown = createShutdown({
      server,
      log: quietLog(),
      cleanup: async () => {
        order.push(`cleanup (listening: ${server.listening})`);
      },
    });

    await shutdown();

    expect(order).toEqual(['cleanup (listening: false)']);
    await expect(get(port)).rejects.toThrow(/ECONNREFUSED/);
  });

  it('lets a request that is already being served finish before it closes', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const server = await listen((_req, res) => {
      void held.then(() => res.end('finished'));
    });
    const cleanup = vi.fn(async () => {});
    const shutdown = createShutdown({ server, log: quietLog(), cleanup });

    const inFlight = get(portOf(server));
    await vi.waitFor(() => expect(server.listening).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const done = shutdown();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cleanup).not.toHaveBeenCalled();
    release();

    await expect(inFlight).resolves.toEqual({ status: 200, body: 'finished' });
    await done;
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('runs the cleanup once however many times it is asked', async () => {
    const server = await listen((_req, res) => res.end('ok'));
    const cleanup = vi.fn(async () => {});
    const shutdown = createShutdown({ server, log: quietLog(), cleanup });

    await Promise.all([shutdown(), shutdown()]);
    await shutdown();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('cuts off a request that never ends once the timeout passes, and still cleans up', async () => {
    const server = await listen(() => {
      /* never answers */
    });
    const cleanup = vi.fn(async () => {});
    const log = quietLog();
    const shutdown = createShutdown({ server, log, cleanup, timeoutMs: 100 });
    const stuck = get(portOf(server)).catch((error: Error) => error);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await shutdown();

    expect(await stuck).toBeInstanceOf(Error);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/timed out|forcing/i));
  });

  it('rejects, and logs, when the cleanup fails', async () => {
    const server = await listen((_req, res) => res.end('ok'));
    const log = quietLog();
    const shutdown = createShutdown({
      server,
      log,
      cleanup: () => Promise.reject(new Error('disconnect failed')),
    });

    await expect(shutdown()).rejects.toThrow('disconnect failed');
    expect(log.error).toHaveBeenCalled();
  });
});

describe('handleSignals', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it.each(['SIGTERM', 'SIGINT'])('shuts down and exits 0 on %s', async (signal) => {
    const proc = new EventEmitter();
    const shutdown = vi.fn(async () => {});
    const exit = vi.fn();
    handleSignals(proc, shutdown, exit, quietLog());

    proc.emit(signal);
    await flush();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits 1 when the shutdown fails', async () => {
    const proc = new EventEmitter();
    const exit = vi.fn();
    handleSignals(proc, () => Promise.reject(new Error('boom')), exit, quietLog());

    proc.emit('SIGTERM');
    await flush();

    expect(exit).toHaveBeenCalledWith(1);
  });
});
