'use client';

import Link from 'next/link';
import { Card } from '@/shared/ui/Card';
import { useLowStock } from '@/features/catalog-admin/hooks/useInventory';

/** Admin landing page — a low-stock summary (real data, GET /api/v1/inventory/low-stock) and quick links, not a decorative dashboard of placeholder widgets. */
export default function AdminDashboardPage() {
  const { items, isLoading } = useLowStock();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/admin/products">
          <Card className="hover:shadow-md transition-shadow"><p className="text-sm text-ink-muted">Manage</p><p className="text-lg font-semibold text-ink">Products</p></Card>
        </Link>
        <Link href="/admin/categories">
          <Card className="hover:shadow-md transition-shadow"><p className="text-sm text-ink-muted">Manage</p><p className="text-lg font-semibold text-ink">Categories</p></Card>
        </Link>
        <Link href="/admin/inventory">
          <Card className="hover:shadow-md transition-shadow"><p className="text-sm text-ink-muted">Manage</p><p className="text-lg font-semibold text-ink">Inventory</p></Card>
        </Link>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Low Stock</h2>
        {isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing is low on stock right now.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.variantId} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">Variant {item.variantId.slice(0, 8)}…</span>
                <span className="text-warning">{item.quantityOnHand} left (threshold {item.lowStockThreshold})</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
