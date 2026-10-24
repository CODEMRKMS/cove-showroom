import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/cove_dev',
  JWT_ACCESS_SECRET: 'a-test-secret-that-is-at-least-32-characters-long',
};

describe('loadConfig', () => {
  it('returns typed config from a valid environment', () => {
    const config = loadConfig({ ...validEnv, PORT: '4100', NODE_ENV: 'production' });

    expect(config.port).toBe(4100);
    expect(config.nodeEnv).toBe('production');
    expect(config.databaseUrl).toBe(validEnv.DATABASE_URL);
    expect(config.jwt.accessSecret).toBe(validEnv.JWT_ACCESS_SECRET);
  });

  it('applies defaults for optional values', () => {
    const config = loadConfig(validEnv);

    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
    expect(config.jwt.accessTtlSeconds).toBe(900);
    expect(config.jwt.issuer).toBe('cove-api');
    expect(config.jwt.audience).toBe('cove-web');
  });

  it('fails fast and names the variable when the JWT secret is missing', () => {
    expect(() => loadConfig({ ...validEnv, JWT_ACCESS_SECRET: undefined })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => loadConfig({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('rejects a PORT that is not a valid port number', () => {
    expect(() => loadConfig({ ...validEnv, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  it('reports every problem at once, not just the first', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET/);
  });
});

describe('loadConfig: hardening settings', () => {
  it('allows only the local Vite origin by default', () => {
    expect(loadConfig(validEnv).corsOrigins).toEqual(['http://localhost:5173']);
  });

  it('reads a comma-separated CORS allow-list and trims each entry', () => {
    const config = loadConfig({
      ...validEnv,
      CORS_ORIGINS: 'https://shop.example.com, http://localhost:5173 ,',
    });

    expect(config.corsOrigins).toEqual(['https://shop.example.com', 'http://localhost:5173']);
  });

  it('rejects a wildcard origin: the API sends credentials, so the list must be explicit', () => {
    expect(() => loadConfig({ ...validEnv, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
  });

  it('rejects an origin that is not a bare scheme://host[:port]', () => {
    expect(() => loadConfig({ ...validEnv, CORS_ORIGINS: 'https://shop.example.com/app' })).toThrow(
      /CORS_ORIGINS/,
    );
    expect(() => loadConfig({ ...validEnv, CORS_ORIGINS: 'shop.example.com' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('has a global rate limit of 300 requests per minute by default', () => {
    expect(loadConfig(validEnv).rateLimit).toEqual({ max: 300, windowSeconds: 60 });
  });

  it('lets the global rate limit be tuned from the environment', () => {
    const config = loadConfig({
      ...validEnv,
      RATE_LIMIT_MAX: '50',
      RATE_LIMIT_WINDOW_SECONDS: '10',
    });

    expect(config.rateLimit).toEqual({ max: 50, windowSeconds: 10 });
  });

  it('logs at info by default, silent under test, and accepts LOG_LEVEL', () => {
    expect(loadConfig(validEnv).logLevel).toBe('info');
    expect(loadConfig({ ...validEnv, NODE_ENV: 'test' }).logLevel).toBe('silent');
    expect(loadConfig({ ...validEnv, LOG_LEVEL: 'debug' }).logLevel).toBe('debug');
    expect(() => loadConfig({ ...validEnv, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});
