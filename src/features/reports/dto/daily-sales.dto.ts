/**
 * Why this file exists: the response shape for "how did today go" — the
 * first piece of the finance/reporting features (daily sale report,
 * udhaar ledger, expenses, etc.) planned for this project. Deliberately
 * scoped to read-only aggregation over the existing Order/OrderItem data
 * — no new tables, since a completed order already IS a sale.
 *
 * Dependencies: none (plain types).
 * Future usage: daily-sales.service.ts builds this; the API route and
 * admin report page both consume it.
 */

export interface BestSellerDto {
  productName: string;
  variantId: string;
  quantitySold: number;
  revenue: number;
}

export interface DailySalesReportDto {
  /** The shop's local calendar date this report covers, YYYY-MM-DD. */
  date: string;
  totalSaleAmount: number;
  completedOrderCount: number;
  bestSellers: BestSellerDto[];
}
