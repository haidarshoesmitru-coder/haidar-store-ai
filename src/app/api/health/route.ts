import { createApiHandler } from '@/shared/lib/api-handler';
import { verifyDatabaseConnection } from '@/shared/lib/db';

/**
 * Why this file exists: the "Health Check Endpoint" item — infrastructure
 * (uptime monitors, load balancers, deploy pipelines) needs one
 * unauthenticated, cheap endpoint that proves the app is up AND actually
 * connected to its database, not just that the Node process is running.
 * A process can be alive while its DB connection is dead; this endpoint
 * catches that distinction.
 *
 * Deliberately public (no `requiredRoleLevel`) — monitoring
 * infrastructure has no user session, and this endpoint reveals nothing
 * sensitive (no schema, no counts, no config).
 *
 * Built on the same `createApiHandler` every other route will use, so
 * even this simple endpoint gets the standard response envelope, request
 * logging, and error handling for free rather than being a one-off
 * special case.
 *
 * Dependencies: api-handler.ts, db.ts.
 * Future usage: referenced by deploy scripts / uptime monitoring once
 * those exist; not extended otherwise — a health check should stay small.
 */
export const GET = createApiHandler(async () => {
  await verifyDatabaseConnection();

  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  };
});
