import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { requireRole, ROLE_LEVEL } from '@/server/auth/rbac';
import { isAppError, InternalError } from '@/shared/lib/errors';
import { successBody, errorBody } from '@/features/catalog/api/response';
import { logger } from '@/shared/lib/logger';
import { getInventoryValuation } from '@/features/reports/services/assets.service';

/**
 * Why this file exists: the one read endpoint behind the admin's Assets
 * page and the WhatsApp get_total_assets owner tool — "kul kitna maal
 * hai" plus the Zakat due on it. Follows the daily-sales route's exact
 * shape (same auth/handler/response envelope).
 *
 * manager-level access (not staff): unlike daily sales totals, this
 * report is built on purchase (cost) prices — the one category this
 * project deliberately restricts to manager+, per the Orders/Inventory
 * cost-visibility rule.
 *
 * Dependencies: server/auth/session.ts, rbac.ts, shared/lib/errors.ts,
 * catalog/api/response.ts, reports/services/assets.service.ts.
 * Future usage: admin/assets page, WhatsApp owner tool.
 */

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const currentUser = await getCurrentUser();
    requireRole(currentUser, ROLE_LEVEL.manager);

    const valuation = await getInventoryValuation();

    return NextResponse.json(successBody(valuation, 'OK'));
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(errorBody(error), { status: error.httpStatus });
    }
    logger.error('Assets report failed', { error: error instanceof Error ? error.stack : String(error) });
    const internalError = new InternalError();
    return NextResponse.json(errorBody(internalError), { status: internalError.httpStatus });
  }
}
