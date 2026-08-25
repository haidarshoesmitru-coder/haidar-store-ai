import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/server/auth/session';
import { requireRole } from '@/server/auth/rbac';
import { isAppError, InternalError } from '@/shared/lib/errors';
import { logger } from '@/shared/lib/logger';
import { successBody, errorBody } from '@/features/orders/api/response';
import type { AuthUser } from '@/features/auth/types';

/**
 * Why this file exists: the Orders module's own route wrapper — identical
 * job to catalog/api/handler.ts (auth resolution, RBAC, try/catch,
 * error-to-HTTP-status mapping, requestId, logging), reusing the same
 * Sprint 1 primitives (session.ts, rbac.ts, errors.ts, logger.ts)
 * unchanged. Every route file under app/api/v1/orders/** wraps its logic
 * in `createOrderRoute(...)`; a route handler's job stays: validate input
 * -> call one service method -> return { data, message?, status? }.
 *
 * Dependencies: server/auth/session.ts, server/auth/rbac.ts,
 * shared/lib/errors.ts, logger.ts, orders/api/response.ts.
 * Future usage: every route file under app/api/v1/orders/**.
 */

interface RouteParams {
  [key: string]: string;
}

interface HandlerContext<P extends RouteParams> {
  req: NextRequest;
  user: AuthUser | null;
  params: P;
}

interface HandlerResult<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
  /** HTTP status for the success case. Defaults to 200; the create-order route passes 201. */
  status?: number;
}

type RouteHandler<T, P extends RouteParams> = (context: HandlerContext<P>) => Promise<HandlerResult<T>>;

interface OrderRouteOptions {
  /** Minimum role level required, e.g. ROLE_LEVEL.staff. Omit for public routes. */
  requiredRoleLevel?: number;
}

export function createOrderRoute<T, P extends RouteParams = RouteParams>(
  handler: RouteHandler<T, P>,
  options: OrderRouteOptions = {},
) {
  return async function routeHandler(
    req: NextRequest,
    routeContext?: { params: P },
  ): Promise<NextResponse> {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const params = routeContext?.params ?? ({} as P);

    try {
      const currentUser = await getCurrentUser();
      const user =
        options.requiredRoleLevel !== undefined
          ? requireRole(currentUser, options.requiredRoleLevel)
          : currentUser;

      const result = await handler({ req, user, params });

      logger.info('Orders request completed', {
        requestId,
        path: req.nextUrl.pathname,
        method: req.method,
        durationMs: Date.now() - startedAt,
      });

      return NextResponse.json(successBody(result.data, result.message ?? 'OK', result.meta ?? null), {
        status: result.status ?? 200,
      });
    } catch (error) {
      if (isAppError(error)) {
        logger.warn('Orders request failed', {
          requestId,
          path: req.nextUrl.pathname,
          code: error.code,
          message: error.message,
        });
        return NextResponse.json(errorBody(error), { status: error.httpStatus });
      }

      logger.error('Orders request — unhandled exception', {
        requestId,
        path: req.nextUrl.pathname,
        error: error instanceof Error ? error.stack : String(error),
      });

      const internalError = new InternalError();
      return NextResponse.json(errorBody(internalError), { status: internalError.httpStatus });
    }
  };
}
