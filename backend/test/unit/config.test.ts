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
