'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { DataTable, type DataTableColumn } from '@/features/catalog-admin/components/DataTable';
import { Modal } from '@/features/catalog-admin/components/Modal';
import { ConfirmDialog } from '@/features/catalog-admin/components/ConfirmDialog';
import { CategoryForm } from '@/features/catalog-admin/forms/CategoryForm';
import { useCategories } from '@/features/catalog-admin/hooks/useCategories';
import { ApiError } from '@/features/catalog-admin/api-client';
import type { CategoryWithSubCategoriesResponseDto } from '@/features/catalog';

/** Categories admin page — list, create, edit, delete, all against the real /api/v1/categories endpoints. */
export default function CategoriesPage() {
  const { categories, isLoading, error, reload, createCategory, updateCategory, deleteCategory } = useCategories();
  const [editingCategory, setEditingCategory] = useState<CategoryWithSubCategoriesResponseDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteCategory(pendingDeleteId);
      setPendingDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete category.');
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: DataTableColumn<CategoryWithSubCategoriesResponseDto>[] = [
    { key: 'name', header: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'slug', header: 'Slug', render: (c) => c.slug },
    { key: 'subCategories', header: 'Subcategories', render: (c) => c.subCategories.length },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditingCategory(c)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(c.id)}>Delete</Button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display">Categories</h1>
        <Button onClick={() => setIsCreating(true)}>+ Add Category</Button>
      </div>

      <DataTable
        columns={columns}
        rows={categories}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        emptyTitle="No categories yet"
        emptyDescription="Add your first category to start organizing products."
      />

      <Modal title="New Category" isOpen={isCreating} onClose={() => setIsCreating(false)}>
        <CategoryForm onSubmit={async (input) => { await createCategory(input); setIsCreating(false); }} onCancel={() => setIsCreating(false)} />
      </Modal>

      <Modal title="Edit Category" isOpen={editingCategory !== null} onClose={() => setEditingCategory(null)}>
        {editingCategory ? (
          <CategoryForm
            initialValues={{ ...editingCategory, description: editingCategory.description ?? undefined }}
            onSubmit={async (input) => { await updateCategory(editingCategory.id, input); setEditingCategory(null); }}
            onCancel={() => setEditingCategory(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title="Delete this category?"
        description={deleteError ?? "This can't be undone. Categories with products or subcategories can't be deleted."}
        confirmLabel="Delete"
        isBusy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => { setPendingDeleteId(null); setDeleteError(null); }}
      />
    </div>
  );
}
