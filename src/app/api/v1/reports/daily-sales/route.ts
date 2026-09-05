import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { requireRole, ROLE_LEVEL } from '@/server/auth/rbac';
import { isAppError, InternalError, ValidationError } from '@/shared/lib/errors';
import { successBody, errorBody } from '@/features/catalog/api/response';
import { logger } from '@/shared/lib/logger';
import { getDailySalesReport, todayInPakistan } from '@/features/reports/services/daily-sales.service';

/**
 * Why this file exists: the one read endpoint behind the admin's Daily
 * Sales Report page. `?date=YYYY-MM-DD` is optional — defaults to
 * today (in Pakistan time, see daily-sales.service.ts) so the common
 * case ("how did today go") needs no query param at all.
 *
 * Reuses catalog's response envelope (successBody/errorBody) rather than
 * inventing a third shape — this is a read-only report endpoint, not
 * part of the Orders or Catalog module specifically, but there's no
 * reason its JSON shape should look different to API consumers than
 * everything else already does.
 *
 * staff-level access (not manager+): today's sale total isn't cost/margin
 * data (the one category this project deliberately restricts to
 * manager+, per the Orders/Inventory cost-visibility rule) — it's the
 * same "how much did we sell" a staff member closing the register would
 * reasonably need to see.
 *
 * Dependencies: server/auth/session.ts, rbac.ts, shared/lib/errors.ts,
 * catalog/api/response.ts, reports/services/daily-sales.service.ts.
 * Future usage: admin/reports page.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const currentUser = await getCurrentUser();
    requireRole(currentUser, ROLE_LEVEL.staff);

    const dateParam = req.nextUrl.searchParams.get('date');
    if (dateParam && !DATE_PATTERN.test(dateParam)) {
      throw new ValidationError('Invalid date format.', [{ field: 'date', issue: 'Expected YYYY-MM-DD.' }]);
    }
    const date = dateParam ?? todayInPakistan();

    const report = await getDailySalesReport(date);

    return NextResponse.json(successBody(report, 'OK'));
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(errorBody(error), { status: error.httpStatus });
    }
    logger.error('Daily sales report failed', { error: error instanceof Error ? error.stack : String(error) });
    const internalError = new InternalError();
    return NextResponse.json(errorBody(internalError), { status: internalError.httpStatus });
  }
}
