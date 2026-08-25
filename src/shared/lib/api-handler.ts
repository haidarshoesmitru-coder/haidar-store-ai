import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/server/auth/session';
import { requireRole } from '@/server/auth/rbac';
import { isAppError, InternalError } from '@/shared/lib/errors';
import { successBody, errorBody } from '@/shared/lib/api-response';
import { logger } from '@/shared/lib/logger';
import type { AuthUser } from '@/features/auth/types';

/**
 * Why this file exists: this is the "API Base Architecture" item from the
 * sprint scope, and it's the single most important file for keeping every
 * future route handler small. Every route handler in this app is
 * expected to be roughly:
 *
 *   export const POST = createApiHandler(async ({ req, user }) => {
 *     const input = validate(someSchema, await req.json());
 *     return someService.doTheThing(input);
 *   }, { requiredRoleLevel: ROLE_LEVEL.manager });
 *
 * Everything else — catching errors, mapping them to the right HTTP
 * status, generating a requestId, logging, checking the role — happens
 * here exactly once. This is what makes the error-response standard from
 * the API architecture doc (§17) an actual guarantee across every
 * endpoint, not a convention 40 route handlers have to remember.
 *
 * No feature routes exist yet this sprint (per scope), but this file is
 * what every future one — products, orders, AI chat — will be built on.
 *
 * Dependencies: session.ts, rbac.ts, errors.ts, api-response.ts, logger.ts.
 * Future usage: every route handler under src/app/api/**.
 */

interface HandlerContext {
  req: NextRequest;
  user: AuthUser | null;
  requestId: string;
}

type RouteHandler<T> = (context: HandlerContext) => Promise<T>;

interface ApiHandlerOptions {
  /** Minimum role level required, e.g. ROLE_LEVEL.manager. Omit for public routes. */
  requiredRoleLevel?: number;
}

export function createApiHandler<T>(
  handler: RouteHandler<T>,
  options: ApiHandlerOptions = {},
) {
  return async function routeHandler(req: NextRequest): Promise<NextResponse> {
    const requestId = randomUUID();
    const startedAt = Date.now();

    try {
      const currentUser = await getCurrentUser();
      const user =
        options.requiredRoleLevel !== undefined
          ? requireRole(currentUser, options.requiredRoleLevel)
          : currentUser;

      const result = await handler({ req, user, requestId });

      logger.info('Request completed', {
        requestId,
        path: req.nextUrl.pathname,
        method: req.method,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(successBody(result));
    } catch (error) {
      if (isAppError(error)) {
        // Expected, intentional failures (validation, not found, forbidden,
        // ...) are logged at `warn`, not `error` — they're not bugs.
        logger.warn('Request failed', {
          requestId,
          path: req.nextUrl.pathname,
          code: error.code,
          message: error.message,
        });
        return NextResponse.json(errorBody(error, requestId), { status: error.httpStatus });
      }

      // Anything NOT one of our known error types is a real bug. Full
      // detail goes to the server log; the client gets a generic message
      // and the requestId to reference when reporting it — never a raw
      // stack trace or DB error string, per the API architecture's error
      // standard.
      logger.error('Unhandled exception', {
        requestId,
        path: req.nextUrl.pathname,
        error: error instanceof Error ? error.stack : String(error),
      });

      const internalError = new InternalError();
      return NextResponse.json(errorBody(internalError, requestId), {
        status: internalError.httpStatus,
      });
    }
  };
}
