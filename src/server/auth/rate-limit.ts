/**
 * Why this file exists: the credentials login endpoint had no
 * brute-force protection — an attacker could try unlimited
 * email/password combinations. This is a minimal in-memory
 * fixed-window limiter: 5 attempts per IP per 15 minutes, keyed for
 * login use (callers prefix the key, e.g. `login:<ip>`).
 *
 * Deliberately simple: no Redis dependency for a single-shop app.
 * Limitation to know: the counters live in this server instance's
 * memory, so on multi-instance/serverless hosting each instance
 * enforces its own window. If the shop ever scales past one instance,
 * swap this for a shared store (Redis/Upstash) — the function
 * signature (`isLoginRateLimited(key)`) won't need to change.
 *
 * Dependencies: none.
 * Future usage: called by app/api/auth/[...nextauth]/route.ts before
 * the credentials callback runs.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

interface AttemptRecord {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, AttemptRecord>();

export interface RateLimitResult {
  limited: boolean;
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfterSeconds: number;
}

export function isLoginRateLimited(key: string): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow forever from
  // one-off scanners. Cheap because it only scans live entries.
  for (const [k, record] of attempts) {
    if (record.resetAt <= now) {
      attempts.delete(k);
    }
  }

  const record = attempts.get(key);

  if (!record || record.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return { limited: false, retryAfterSeconds: 0 };
}
