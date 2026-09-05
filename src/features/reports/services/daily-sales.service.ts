import { db } from '@/shared/lib/db';
import type { DailySalesReportDto, BestSellerDto } from '@/features/reports/dto/daily-sales.dto';

/**
 * Why this file exists: "today's sales" and "best sellers" are both
 * derived entirely from Order/OrderItem rows the Orders module already
 * writes — a COMPLETED order's total IS a sale, so this is a read-only
 * aggregation, not a new source of truth. No new tables, matching how
 * this project has always preferred deriving a number over storing a
 * duplicate of it (see Orders' own no-show count, computed fresh each
 * time rather than cached).
 *
 * "Sale" = COMPLETED orders only — PENDING hasn't happened yet,
 * CANCELLED isn't a sale. The completion date is read off `updatedAt`
 * rather than `createdAt`: COMPLETED and CANCELLED are terminal
 * statuses with no further transitions allowed (see
 * order.repository.impl.ts's ALLOWED_TRANSITIONS), so an order's
 * `updatedAt` the moment it reaches COMPLETED never changes again —
 * it's a reliable "completed at" timestamp without needing a dedicated
 * column for it.
 *
 * Day boundaries are computed in Pakistan time (UTC+5, no DST) regardless
 * of the server's own timezone (Vercel runs UTC) — the shop has one
 * timezone, hardcoding it here is simpler and more correct for this
 * single-location business than pulling in a general timezone library.
 *
 * Dependencies: db.ts, daily-sales.dto.ts.
 * Future usage: the daily-sales API route; later reports (weekly/monthly
 * summaries) can reuse the same day-boundary logic.
 */

const PAKISTAN_UTC_OFFSET = '+05:00';

/** Today's date (YYYY-MM-DD) as it currently is in Pakistan, regardless of the server's own timezone. */
export function todayInPakistan(): string {
  const nowUtc = new Date();
  const shifted = new Date(nowUtc.getTime() + 5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function dayBoundsInPakistan(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00${PAKISTAN_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getDailySalesReport(date: string): Promise<DailySalesReportDto> {
  const { start, end } = dayBoundsInPakistan(date);

  const completedOrders = await db.order.findMany({
    where: {
      status: 'COMPLETED',
      updatedAt: { gte: start, lt: end },
    },
    include: { items: true },
  });

  const totalSaleAmount = completedOrders.reduce((sum, order) => sum + Number(order.total), 0);

  const byVariant = new Map<string, { productName: string; quantitySold: number; revenue: number }>();
  for (const order of completedOrders) {
    for (const item of order.items) {
      const existing = byVariant.get(item.variantId);
      const quantity = item.quantity;
      const revenue = Number(item.lineTotal);
      if (existing) {
        existing.quantitySold += quantity;
        existing.revenue += revenue;
      } else {
        byVariant.set(item.variantId, {
          productName: item.productNameSnapshot,
          quantitySold: quantity,
          revenue,
        });
      }
    }
  }

  const bestSellers: BestSellerDto[] = Array.from(byVariant.entries())
    .map(([variantId, data]) => ({ variantId, ...data }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 5);

  return {
    date,
    totalSaleAmount,
    completedOrderCount: completedOrders.length,
    bestSellers,
  };
}
