'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { DataTable, type DataTableColumn } from '@/features/catalog-admin/components/DataTable';
import { Modal } from '@/features/catalog-admin/components/Modal';
import { ConfirmDialog } from '@/features/catalog-admin/components/ConfirmDialog';
import { BrandForm } from '@/features/catalog-admin/forms/BrandForm';
import { useBrands } from '@/features/catalog-admin/hooks/useBrands';
import { ApiError } from '@/features/catalog-admin/api-client';
import type { BrandResponseDto } from '@/features/catalog';

/** Brands admin page — same pattern as categories/page.tsx. */
export default function BrandsPage() {
  const { brands, isLoading, error, reload, createBrand, updateBrand, deleteBrand } = useBrands();
  const [editingBrand, setEditingBrand] = useState<BrandResponseDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteBrand(pendingDeleteId);
      setPendingDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete brand.');
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: DataTableColumn<BrandResponseDto>[] = [
    { key: 'name', header: 'Name', render: (b) => <span className="font-medium">{b.name}</span> },
    { key: 'slug', header: 'Slug', render: (b) => b.slug },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditingBrand(b)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(b.id)}>Delete</Button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display">Brands</h1>
        <Button onClick={() => setIsCreating(true)}>+ Add Brand</Button>
      </div>

      <DataTable
        columns={columns}
        rows={brands}
        rowKey={(b) => b.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No brands yet"
        emptyDescription="Add a brand to start associating it with products."
      />

      <Modal title="New Brand" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <BrandForm onSubmit={async (input) => { await createBrand(input); setIsCreating(false); }} onCancel={() => setIsCreating(false)} />
      </Modal>

      <Modal title="Edit Brand" isOpen={editingBrand !== null} onClose={() => setEditingBrand(null)}>
        {editingBrand ? (
          <BrandForm
            initialValues={{ ...editingBrand, logoUrl: editingBrand.logoUrl ?? undefined }}
            onSubmit={async (input) => { await updateBrand(editingBrand.id, input); setEditingBrand(null); }}
            onCancel={() => setEditingBrand(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title="Delete this brand?"
        description={deleteError ?? "This can't be undone. Brands still used by products can't be deleted."}
        confirmLabel="Delete"
        isBusy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => { setPendingDeleteId(null); setDeleteError(null); }}
      />
    </div>
  );
}
