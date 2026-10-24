import { describe, expect, it } from 'vitest';
import { ConfigError } from '../../src/config.js';
import { loadSeedConfig } from '../../src/seed/seed-config.js';

const ADMIN = { ADMIN_EMAIL: 'owner@example.test', ADMIN_PASSWORD: 'a-long-admin-passphrase' };

describe('loadSeedConfig', () => {
  it('reads the admin account from ADMIN_EMAIL and ADMIN_PASSWORD, with the email normalised', () => {
    const config = loadSeedConfig({ ...ADMIN, ADMIN_EMAIL: '  Owner@Example.TEST ' });

    expect(config).toEqual({
      admin: { email: 'owner@example.test', password: ADMIN.ADMIN_PASSWORD },
    });
  });

  it('has no demo user unless one is configured', () => {
    expect(loadSeedConfig(ADMIN).demoUser).toBeUndefined();
  });

  it('adds a demo user when both DEMO_USER_EMAIL and DEMO_USER_PASSWORD are set', () => {
    const config = loadSeedConfig({
      ...ADMIN,
      DEMO_USER_EMAIL: 'Buyer@Example.test',
      DEMO_USER_PASSWORD: 'a-long-buyer-passphrase',
    });

    expect(config.demoUser).toEqual({
      email: 'buyer@example.test',
      password: 'a-long-buyer-passphrase',
    });
  });

  it('fails naming every missing admin variable', () => {
    expect(() => loadSeedConfig({})).toThrow(ConfigError);
    expect(() => loadSeedConfig({})).toThrow(/ADMIN_EMAIL[\s\S]*ADMIN_PASSWORD/);
  });

  it('rejects an email that is not an email address', () => {
    expect(() => loadSeedConfig({ ...ADMIN, ADMIN_EMAIL: 'not-an-email' })).toThrow(/ADMIN_EMAIL/);
  });

  it('applies the registration password policy to the admin password', () => {
    expect(() => loadSeedConfig({ ...ADMIN, ADMIN_PASSWORD: 'short' })).toThrow(/ADMIN_PASSWORD/);
    expect(() => loadSeedConfig({ ...ADMIN, ADMIN_PASSWORD: 'password123' })).toThrow(
      /ADMIN_PASSWORD.*common/,
    );
  });

  it('applies the same policy to the demo user password', () => {
    expect(() =>
      loadSeedConfig({ ...ADMIN, DEMO_USER_EMAIL: 'b@example.test', DEMO_USER_PASSWORD: 'short' }),
    ).toThrow(/DEMO_USER_PASSWORD/);
  });

  it('requires DEMO_USER_EMAIL and DEMO_USER_PASSWORD together', () => {
    expect(() => loadSeedConfig({ ...ADMIN, DEMO_USER_EMAIL: 'b@example.test' })).toThrow(
      /DEMO_USER_PASSWORD/,
    );
    expect(() =>
      loadSeedConfig({ ...ADMIN, DEMO_USER_PASSWORD: 'a-long-buyer-passphrase' }),
    ).toThrow(/DEMO_USER_EMAIL/);
  });

  it('refuses to use one email for both accounts', () => {
    expect(() =>
      loadSeedConfig({
        ...ADMIN,
        DEMO_USER_EMAIL: ADMIN.ADMIN_EMAIL,
        DEMO_USER_PASSWORD: 'a-long-buyer-passphrase',
      }),
    ).toThrow(/DEMO_USER_EMAIL/);
  });

  it('never puts a password in the error message', () => {
    try {
      loadSeedConfig({ ...ADMIN, ADMIN_PASSWORD: 'tooshort' });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('tooshort');
    }
  });
});
