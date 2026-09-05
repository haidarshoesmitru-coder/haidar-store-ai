'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { ErrorState } from '@/shared/ui/StatusState';
import { apiClient, ApiError } from '@/features/catalog-admin/api-client';

/**
 * Why this file exists: the admin's daily sales view — today's total
 * sale amount and best-selling products by default, with a date field
 * to check any other day. Talks to `GET /api/v1/reports/daily-sales`
 * (this sprint) through the shared `apiClient`, same pattern as every
 * other admin page — no separate fetch logic invented here.
 */

interface BestSellerDto {
  productName: string;
  variantId: string;
  quantitySold: number;
  revenue: number;
}

interface DailySalesReportDto {
  date: string;
  totalSaleAmount: number;
  completedOrderCount: number;
  bestSellers: BestSellerDto[];
}

function formatRs(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

export default function ReportsPage() {
  const [date, setDate] = useState('');
  const [report, setReport] = useState<DailySalesReportDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(selectedDate?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<DailySalesReportDto>(
        '/reports/daily-sales',
        selectedDate ? { date: selectedDate } : undefined,
      );
      setReport(data);
      setDate(data.date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load report.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">Daily Sales Report</h1>
        <div className="w-48">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(event) => load(event.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <ErrorState title="Couldn't load the report" description={error} actionLabel="Retry" onAction={() => load(date)} />
      ) : report ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-sm text-ink-muted">Total Sale</p>
              <p className="mt-1 text-3xl font-bold text-ink">{formatRs(report.totalSaleAmount)}</p>
              <p className="mt-1 text-xs text-ink-faint">{report.completedOrderCount} completed order(s)</p>
            </Card>
            <Card>
              <p className="text-sm text-ink-muted">Date</p>
              <p className="mt-1 text-3xl font-bold text-ink">{report.date}</p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-ink">Best Sellers</h2>
            {report.bestSellers.length === 0 ? (
              <p className="text-sm text-ink-muted">No completed orders on this day yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Quantity Sold</th>
                    <th className="pb-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bestSellers.map((item) => (
                    <tr key={item.variantId} className="border-b border-border last:border-0">
                      <td className="py-2 text-ink">{item.productName}</td>
                      <td className="py-2 text-ink">{item.quantitySold}</td>
                      <td className="py-2 text-ink">{formatRs(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
