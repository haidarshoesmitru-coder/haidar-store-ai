import { z } from 'zod';

/**
 * Why this file exists:
 * Every other module that needs an env var imports `env` from here instead
 * of reading `process.env` directly. That gives us three things a scattered
 * `process.env.WHATEVER` never does:
 *   1. One place that knows the full list of required config — you can read
 *      this file and know exactly what the app needs to run.
 *   2. A crash at boot, with a specific message, if something is missing —
 *      not a null-pointer-style failure three requests into production.
 *   3. Correct types everywhere else (`env.NODE_ENV` is a literal union,
 *      not `string | undefined`).
 *
 * Dependencies: zod only.
 * Future usage: every server-side module that needs config reads it from
 * here — db.ts reads DATABASE_URL, the auth config reads NEXTAUTH_SECRET,
 * future AI modules will add ANTHROPIC_API_KEY here (not inline).
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  ALLOWED_ORIGINS: z.string().default(''),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    // Intentionally thrown, not logged-and-continued: a misconfigured
    // environment should never serve traffic, even degraded.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

/**
 * Next.js requires app/error.tsx to be a Client Component, and it imports
 * logger.ts (for `logger.error` on render failures) which imports this
 * module — so this file ends up in the client bundle whether or not any
 * client code actually needs it. On the client, `process.env` only ever
 * exposes `NEXT_PUBLIC_*` vars, so validating the full schema (which
 * requires DATABASE_URL, NEXTAUTH_SECRET, etc.) would throw on every page
 * load before any real error even occurred.
 *
 * The fix is `typeof window === 'undefined'` as the server/client split:
 * on the server, validate for real and fail loudly on misconfiguration
 * (the original intent, preserved exactly). On the client, skip
 * validation and return safe defaults — client code reading this module
 * only ever needs LOG_LEVEL (via logger.ts); it must never need
 * DATABASE_URL or NEXTAUTH_SECRET, and if some future client code tried
 * to, that would be its own bug to catch in review, not something this
 * module should paper over by inventing fake secret values.
 */
const CLIENT_SAFE_DEFAULTS: Env = {
  NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) ?? 'development',
  DATABASE_URL: '',
  DIRECT_URL: '',
  NEXTAUTH_URL: '',
  NEXTAUTH_SECRET: '',
  ALLOWED_ORIGINS: '',
  LOG_LEVEL: 'info',
};

export const env: Env = typeof window === 'undefined' ? loadEnv() : CLIENT_SAFE_DEFAULTS;
