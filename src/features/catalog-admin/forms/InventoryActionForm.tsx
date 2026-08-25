'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, Textarea } from '@/features/catalog-admin/components/FormFields';
import { stockIn, stockOut, adjustInventory } from '@/features/catalog-admin/hooks/useInventory';
import { ApiError } from '@/features/catalog-admin/api-client';

/**
 * Why this file exists: the Stock In / Stock Out / Adjust actions for one
 * variant, against the real `/api/v1/inventory/{stock-in,stock-out,adjust}`
 * endpoints (Sprint 2.3). One form, three modes, since the fields
 * (quantity + note) are nearly identical and a mode switch reads more
 * clearly than three near-duplicate components.
 */

type Mode = 'in' | 'out' | 'adjust';

export function InventoryActionForm({ variantId, onDone }: { variantId: string; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('in');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const qty = Number(quantity);
    if (!qty) {
      setError('Enter a quantity.');
      return;
    }
    if (mode === 'adjust' && !note.trim()) {
      setError('A note is required for manual adjustments.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'in') await stockIn({ variantId, quantity: qty, ...(note ? { note } : {}) });
      else if (mode === 'out') await stockOut({ variantId, quantity: qty, ...(note ? { note } : {}) });
      else await adjustInventory({ variantId, quantityDelta: qty, note });

      setQuantity('');
      setNote('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record inventory change.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Select label="Action" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
        <option value="in">Stock In (received)</option>
        <option value="out">Stock Out (removed)</option>
        <option value="adjust">Adjust (correction — can be negative)</option>
      </Select>
      <Input
        label={mode === 'adjust' ? 'Quantity change (+/-)' : 'Quantity'}
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <Textarea label={mode === 'adjust' ? 'Reason (required)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!quantity}>
        Record
      </Button>
    </div>
  );
}
