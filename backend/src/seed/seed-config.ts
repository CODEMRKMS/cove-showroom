import { z } from 'zod';
import { ConfigError } from '../config.js';
import { passwordProblem } from '../domain/password-policy.js';

export type SeedAccount = { email: string; password: string };

export type SeedConfig = { admin: SeedAccount; demoUser?: SeedAccount };

// Same rules a user faces when registering, so the seeded admin is never weaker than a customer.
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});

const seedEnv = z
  .object({
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    DEMO_USER_EMAIL: email.optional(),
    DEMO_USER_PASSWORD: password.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.DEMO_USER_EMAIL && !env.DEMO_USER_PASSWORD) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEMO_USER_PASSWORD'],
        message: 'is required when DEMO_USER_EMAIL is set',
      });
    }
    if (env.DEMO_USER_PASSWORD && !env.DEMO_USER_EMAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEMO_USER_EMAIL'],
        message: 'is required when DEMO_USER_PASSWORD is set',
      });
    }
    if (env.DEMO_USER_EMAIL && env.DEMO_USER_EMAIL === env.ADMIN_EMAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEMO_USER_EMAIL'],
        message: 'must differ from ADMIN_EMAIL',
      });
    }
  });

/**
 * Reads the accounts the seed script creates. Problems name the variable and the rule, never the
 * value, so a password cannot leak into a terminal or a CI log through an error message.
 */
export function loadSeedConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  const parsed = seedEnv.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const e = parsed.data;
  return {
    admin: { email: e.ADMIN_EMAIL, password: e.ADMIN_PASSWORD },
    ...(e.DEMO_USER_EMAIL &&
      e.DEMO_USER_PASSWORD && {
        demoUser: { email: e.DEMO_USER_EMAIL, password: e.DEMO_USER_PASSWORD },
      }),
  };
}
