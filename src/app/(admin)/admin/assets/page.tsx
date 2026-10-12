'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';
import { ErrorState } from '@/shared/ui/StatusState';
import { apiClient, ApiError } from '@/features/catalog-admin/api-client';
import type { InventoryValuationDto } from '@/features/reports/dto/assets.dto';

/**
 * Why this file exists: the admin's "kul kitna maal hai" view — total
 * inventory value, the Zakat due on it (2.5%), total units, and the
 * value broken down by category. Talks to `GET /api/v1/reports/assets`
 * through the shared `apiClient`, same pattern as the daily-sales
 * reports page — no separate fetch logic invented here.
 *
 * Valuation = on-hand quantity × purchase price per variant (sale price
 * where purchase price was never recorded — flagged on the page so the
 * owner knows that slice is approximate). Manager-level data, like all
 * cost-price-derived numbers in this project.
 */

function formatRs(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

export default function AssetsPage() {
  const [report, setReport] = useState<InventoryValuationDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<InventoryValuationDto>('/reports/assets');
      setReport(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load assets report.');
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
      <h1 className="text-2xl font-bold text-ink">Total Assets &amp; Zakat</h1>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <ErrorState title="Couldn't load the assets report" description={error} actionLabel="Retry" onAction={load} />
      ) : report ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-ink-muted">Total Assets (kul maal)</p>
              <p className="mt-1 text-3xl font-bold text-ink">{formatRs(report.totalValue)}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {report.productCount} products · {report.variantCount} variants · {report.totalUnits.toLocaleString('en-PK')} units
              </p>
            </Card>
            <Card>
              <p className="text-sm text-ink-muted">Zakat Due (2.5%)</p>
              <p className="mt-1 text-3xl font-bold text-ink">{formatRs(report.zakat)}</p>
              <p className="mt-1 text-xs text-ink-faint">on trade inventory value</p>
            </Card>
            <Card>
              <p className="text-sm text-ink-muted">Total Units in Stock</p>
              <p className="mt-1 text-3xl font-bold text-ink">{report.totalUnits.toLocaleString('en-PK')}</p>
              <p className="mt-1 text-xs text-ink-faint">across all categories</p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-ink">Value by Category</h2>
            {report.byCategory.length === 0 ? (
              <p className="text-sm text-ink-muted">No stock on hand yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Units</th>
                    <th className="pb-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCategory.map((item) => (
                    <tr key={item.categoryName} className="border-b border-border last:border-0">
                      <td className="py-2 text-ink">{item.categoryName}</td>
                      <td className="py-2 text-ink">{item.units.toLocaleString('en-PK')}</td>
                      <td className="py-2 text-ink">{formatRs(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="text-xs text-ink-faint">
            Valuation = on-hand quantity × purchase price per variant
            {report.fallbackCount > 0 &&
              ` · ${report.fallbackCount} variant(s) valued at sale price because their purchase price was never recorded.`}
          </p>
        </>
      ) : null}
    </div>
  );
}
