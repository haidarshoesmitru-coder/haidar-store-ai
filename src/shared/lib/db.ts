import { PrismaClient } from '@prisma/client';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists:
 * Next.js dev mode hot-reloads modules on every save. If a PrismaClient
 * were instantiated at the top of a normal module, each reload would
 * create a new client (and a new connection pool) without closing the old
 * one — a well-known way to exhaust Postgres connections in local dev
 * within minutes. Stashing the client on `globalThis` in development
 * survives the reload; production gets a fresh single instance per process
 * as normal, since there's no hot-reload there.
 *
 * Responsibility: construct and export exactly one PrismaClient for the
 * whole app. Nothing else — no query logic lives here.
 *
 * Dependencies: env.ts (for DATABASE_URL, implicitly via Prisma), logger.ts.
 * Future usage: every repository (UserRepository now; ProductRepository,
 * OrderRepository, etc. in later sprints) imports `db` from here. No
 * feature module ever instantiates its own PrismaClient.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  return new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const db = globalThis.__prisma ?? createClient();

if (env.NODE_ENV === 'development') {
  globalThis.__prisma = db;
}

/**
 * Call once at process start (or lazily on first query — Prisma connects
 * lazily by default). Exposed explicitly so a future health-check endpoint
 * can verify connectivity without relying on side effects of an unrelated
 * query.
 */
export async function verifyDatabaseConnection(): Promise<void> {
  try {
    await db.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');
  } catch (error) {
    logger.error('Database connection failed', { error: String(error) });
    throw error;
  }
}
