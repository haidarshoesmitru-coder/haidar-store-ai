'use client';

import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/features/catalog-admin/components/Modal';
import { StockBadge } from '@/features/catalog-admin/components/StatusBadge';
import { InventoryActionForm } from '@/features/catalog-admin/forms/InventoryActionForm';
import { useLowStock, useInventoryHistory } from '@/features/catalog-admin/hooks/useInventory';

/**
 * Why this file exists: the Inventory dashboard — low-stock list (`GET
 * /api/v1/inventory/low-stock`), stock in/out/adjust actions, and a
 * per-variant transaction history viewer, all against Sprint 2.3's real
 * inventory endpoints.
 *
 * Variant selection for actions/history is driven by the low-stock list
 * (click "Manage") or by pasting a variant ID directly — there's no
 * cross-catalog variant search endpoint yet (only product-scoped variant
 * listing exists), so a direct-ID lookup is the honest, working option
 * rather than a search box with nothing to search against.
 */
export default function InventoryPage() {
  const { items, isLoading, error, reload } = useLowStock();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [manualVariantId, setManualVariantId] = useState('');
  const { transactions, isLoading: isHistoryLoading, reload: reloadHistory } = useInventoryHistory(selectedVariantId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display">Inventory</h1>

      <Card>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Manage a variant by ID" value={manualVariantId} onChange={(e) => setManualVariantId(e.target.value)} placeholder="Paste a variant ID…" />
          </div>
          <Button variant="secondary" onClick={() => setSelectedVariantId(manualVariantId.trim() || null)} disabled={!manualVariantId.trim()}>
            Manage
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">Low Stock</h2>
        {isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-error">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing is low on stock right now.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.variantId} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-ink">Variant {item.variantId.slice(0, 8)}…</p>
                  <StockBadge quantity={item.quantityOnHand} threshold={item.lowStockThreshold} />
                </div>
                <Button size="sm" variant="secondary" onClick={() => setSelectedVariantId(item.variantId)}>
                  Manage
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal title="Manage Stock" isOpen={selectedVariantId !== null} onClose={() => setSelectedVariantId(null)}>
        {selectedVariantId ? (
          <div className="flex flex-col gap-6">
            <InventoryActionForm
              variantId={selectedVariantId}
              onDone={() => {
                void reload();
                void reloadHistory();
              }}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Recent History</h3>
              {isHistoryLoading ? (
                <p className="text-sm text-ink-muted">Loading…</p>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-ink-muted">No transactions yet.</p>
              ) : (
                <ul className="max-h-48 divide-y divide-border overflow-y-auto text-sm">
                  {transactions.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between py-1.5">
                      <span className="text-ink">{tx.type}</span>
                      <span className={tx.quantity < 0 ? 'text-error' : 'text-accent'}>{tx.quantity > 0 ? '+' : ''}{tx.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
