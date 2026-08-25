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

export const env = loadEnv();
