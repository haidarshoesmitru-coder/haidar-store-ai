'use client';

import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StatusState';

/**
 * Why this file exists: one generic table shell — header, rows, loading
 * skeleton, empty state, error state — reused by every list page
 * (categories, brands, products) instead of five bespoke tables with
 * slightly different loading/empty handling. Columns and row-rendering
 * are supplied by the caller; this component owns only the table
 * scaffolding and the three non-happy-path states the task's error
 * handling requirement calls for.
 */

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription?: string;
}

export function DataTable<T>({ columns, rows, rowKey, isLoading, error, onRetry, emptyTitle, emptyDescription }: DataTableProps<T>) {
  if (error) {
    return <ErrorState title="Couldn't load this list" description={error} actionLabel={onRetry ? 'Try again' : undefined} onAction={onRetry} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-sunken">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-semibold text-ink-muted">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border last:border-0">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3">
                    <Skeleton height="1rem" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8">
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-surface-sunken">
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 text-ink ${column.className ?? ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
