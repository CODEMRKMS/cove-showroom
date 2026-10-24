import { describe, expect, it } from 'vitest';
import { captureLogs } from '../helpers/log-capture.js';

describe('createLogger', () => {
  it('writes one JSON object per line with a numeric level and a message', () => {
    const logs = captureLogs();

    logs.log.info({ port: 3000 }, 'API listening');

    expect(logs.lines()).toEqual([
      expect.objectContaining({ level: 30, port: 3000, msg: 'API listening' }),
    ]);
  });

  it('writes nothing below the configured level', () => {
    const logs = captureLogs('warn');

    logs.log.info('hidden');
    logs.log.warn('shown');

    expect(logs.lines().map((line) => line.msg)).toEqual(['shown']);
  });

  it('is silent when the level is silent', () => {
    const logs = captureLogs('silent');

    logs.log.fatal('nothing');

    expect(logs.raw()).toBe('');
  });

  it('redacts authorization and cookie headers wherever a request or response is logged', () => {
    const logs = captureLogs();

    logs.log.info(
      {
        req: {
          headers: {
            authorization: 'Bearer abc.def.ghi',
            cookie: 'refresh_token=s3cret',
            accept: 'json',
          },
        },
        res: { headers: { 'set-cookie': ['refresh_token=n3w; HttpOnly'] } },
      },
      'request',
    );

    const [line] = logs.lines();
    expect(line!.req.headers).toEqual({
      authorization: '[Redacted]',
      cookie: '[Redacted]',
      accept: 'json',
    });
    expect(line!.res.headers['set-cookie']).toBe('[Redacted]');
    expect(logs.raw()).not.toMatch(/abc\.def\.ghi|s3cret|n3w/);
  });
});
