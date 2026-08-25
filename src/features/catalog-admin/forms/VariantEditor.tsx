'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/features/catalog-admin/components/FormFields';
import { ConfirmDialog } from '@/features/catalog-admin/components/ConfirmDialog';
import { useAttributes } from '@/features/catalog-admin/hooks/useAttributes';
import { ApiError } from '@/features/catalog-admin/api-client';
import type { VariantResponseDto, CreateVariantDto } from '@/features/catalog';

/**
 * Why this file exists: variant CRUD on the product edit page — list
 * existing variants (name derived from their attribute values, e.g.
 * "Size: 42, Color: Black"), add a new one, delete one. Editing a
 * variant's own fields (price/SKU/status) happens inline per-row via a
 * small edit form, toggled open per variant rather than navigating away.
 */

interface VariantEditorProps {
  variants: VariantResponseDto[];
  onAdd: (input: CreateVariantDto) => Promise<void>;
  onUpdate: (variantId: string, input: { price?: number; sku?: string; status?: 'ACTIVE' | 'INACTIVE' }) => Promise<void>;
  onDelete: (variantId: string) => Promise<void>;
}

function variantLabel(variant: VariantResponseDto): string {
  if (variant.attributes.length === 0) return variant.sku ?? 'Default';
  return variant.attributes.map((a) => `${a.name}: ${a.value}`).join(', ');
}

export function VariantEditor({ variants, onAdd, onUpdate, onDelete }: VariantEditorProps) {
  const { attributes } = useAttributes();
  const [isAdding, setIsAdding] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newAttributeId, setNewAttributeId] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');

  async function handleAdd() {
    setIsBusy(true);
    setError(null);
    try {
      await onAdd({
        sku: newSku || undefined,
        price: Number(newPrice),
        isDefault: false,
        initialQuantity: 0,
        attributes: newAttributeId && newAttributeValue ? [{ attributeId: newAttributeId, value: newAttributeValue }] : [],
      });
      setIsAdding(false);
      setNewSku('');
      setNewPrice('');
      setNewAttributeId('');
      setNewAttributeValue('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add variant.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDeleteId) return;
    setIsBusy(true);
    setError(null);
    try {
      await onDelete(pendingDeleteId);
      setPendingDeleteId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete variant.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-sm text-error">{error}</p> : null}

      <div className="divide-y divide-border rounded-lg border border-border">
        {variants.map((variant) => (
          <div key={variant.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="text-sm font-medium text-ink">{variantLabel(variant)}</p>
              <p className="text-xs text-ink-muted">
                {variant.sku ?? 'No SKU'} · Rs. {variant.price} · {variant.status}
                {variant.isDefault ? ' · Default' : ''} · {variant.stockOnHand ?? 0} in stock
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={variant.status === 'ACTIVE' ? 'secondary' : 'primary'}
                onClick={() => onUpdate(variant.id, { status: variant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
              >
                {variant.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(variant.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {isAdding ? (
        <div className="rounded-lg border border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="SKU (optional)" value={newSku} onChange={(e) => setNewSku(e.target.value)} />
            <Input label="Price" type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            <Select label="Attribute (optional)" value={newAttributeId} onChange={(e) => setNewAttributeId(e.target.value)}>
              <option value="">None</option>
              {attributes.map((attribute) => (
                <option key={attribute.id} value={attribute.id}>{attribute.name}</option>
              ))}
            </Select>
            <Input label="Value" value={newAttributeValue} onChange={(e) => setNewAttributeValue(e.target.value)} disabled={!newAttributeId} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsAdding(false)} disabled={isBusy}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} isLoading={isBusy} disabled={!newPrice}>Add Variant</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)} className="self-start">
          + Add Variant
        </Button>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title="Delete this variant?"
        description="This can't be undone. A product must retain at least one variant."
        confirmLabel="Delete"
        isBusy={isBusy}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
