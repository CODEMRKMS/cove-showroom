import { z } from 'zod';

// The only place that reads environment variables. Everything else receives
// this typed object, so a missing or weak value stops the process at boot.
// Comma-separated list of exact origins (scheme://host[:port]). No wildcard: the API sends credentials.
const corsOrigins = z
  .string()
  .default('http://localhost:5173')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .refine((origins) => origins.length > 0, 'must list at least one origin')
  .refine(
    (origins) =>
      origins.every((origin) => URL.canParse(origin) && new URL(origin).origin === origin),
    'must be exact origins like https://shop.example.com (no wildcard, path or trailing slash)',
  );

const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
  JWT_ISSUER: z.string().min(1).default('cove-api'),
  JWT_AUDIENCE: z.string().min(1).default('cove-web'),
  CORS_ORIGINS: corsOrigins,
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: logLevel.optional(),
});

export type Config = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  /** Failed login attempts allowed per client IP within the window. */
  authRateLimit: { max: number; windowSeconds: number };
  /** Origins allowed to call the API from a browser. */
  corsOrigins: string[];
  /** Requests allowed per client IP per window across the whole API (health checks excluded). */
  rateLimit: { max: number; windowSeconds: number };
  logLevel: z.infer<typeof logLevel>;
  /** Lifetime of the opaque refresh token and its cookie (default 7 days). */
  refreshTtlSeconds: number;
  jwt: {
    accessSecret: string;
    accessTtlSeconds: number;
    issuer: string;
    audience: string;
  };
};

export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    authRateLimit: {
      max: e.AUTH_RATE_LIMIT_MAX,
      windowSeconds: e.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    },
    corsOrigins: e.CORS_ORIGINS,
    rateLimit: { max: e.RATE_LIMIT_MAX, windowSeconds: e.RATE_LIMIT_WINDOW_SECONDS },
    // Tests stay quiet unless a test asks for output.
    logLevel: e.LOG_LEVEL ?? (e.NODE_ENV === 'test' ? 'silent' : 'info'),
    refreshTtlSeconds: e.REFRESH_TOKEN_TTL_SECONDS,
    jwt: {
      accessSecret: e.JWT_ACCESS_SECRET,
      accessTtlSeconds: e.JWT_ACCESS_TTL_SECONDS,
      issuer: e.JWT_ISSUER,
      audience: e.JWT_AUDIENCE,
    },
  };
}
