import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/server/auth/session';
import { requireRole } from '@/server/auth/rbac';
import { isAppError, InternalError } from '@/shared/lib/errors';
import { logger } from '@/shared/lib/logger';
import { successBody, errorBody } from '@/features/catalog/api/response';
import type { AuthUser } from '@/features/auth/types';

/**
 * Why this file exists: the Catalog module's own route wrapper — the same
 * job Sprint 1's `createApiHandler` does (auth resolution, RBAC, try/catch,
 * error-to-HTTP-status mapping, requestId generation, logging), reusing
 * every one of those Sprint 1 primitives unchanged, but emitting the
 * `{ success, message, data, meta }` envelope this sprint's spec requires
 * instead of Sprint 1's `{ data }` shape. See response.ts for why that
 * envelope lives here rather than in shared/lib.
 *
 * Every route file in app/api/v1/{categories,brands,products,...} wraps
 * its logic in `createCatalogRoute(...)`. A route handler's job stays:
 * validate input -> call one service method -> return { data, message?,
 * meta? }. Everything else — including which HTTP status a success
 * response gets — is decided here, once.
 *
 * Dependencies: server/auth/session.ts, server/auth/rbac.ts (Sprint 1,
 * unchanged), shared/lib/errors.ts (Sprint 1, unchanged), logger.ts
 * (Sprint 1, unchanged), catalog/api/response.ts (this sprint).
 * Future usage: every route file under app/api/v1/** for this module.
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
  /** HTTP status for the success case. Defaults to 200; routes that create a resource pass 201. */
  status?: number;
}

type RouteHandler<T, P extends RouteParams> = (context: HandlerContext<P>) => Promise<HandlerResult<T>>;

interface CatalogRouteOptions {
  /** Minimum role level required, e.g. ROLE_LEVEL.manager. Omit for public routes. */
  requiredRoleLevel?: number;
}

export function createCatalogRoute<T, P extends RouteParams = RouteParams>(
  handler: RouteHandler<T, P>,
  options: CatalogRouteOptions = {},
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

      logger.info('Catalog request completed', {
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
        logger.warn('Catalog request failed', {
          requestId,
          path: req.nextUrl.pathname,
          code: error.code,
          message: error.message,
        });
        return NextResponse.json(errorBody(error), { status: error.httpStatus });
      }

      logger.error('Catalog request — unhandled exception', {
        requestId,
        path: req.nextUrl.pathname,
        error: error instanceof Error ? error.stack : String(error),
      });

      const internalError = new InternalError();
      return NextResponse.json(errorBody(internalError), { status: internalError.httpStatus });
    }
  };
}
