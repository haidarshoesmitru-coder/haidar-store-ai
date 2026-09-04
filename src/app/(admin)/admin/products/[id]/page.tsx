'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, Textarea } from '@/features/catalog-admin/components/FormFields';
import { StatusBadge } from '@/features/catalog-admin/components/StatusBadge';
import { ConfirmDialog } from '@/features/catalog-admin/components/ConfirmDialog';
import { ImageManager } from '@/features/catalog-admin/components/ImageManager';
import { VariantEditor } from '@/features/catalog-admin/forms/VariantEditor';
import { useProduct } from '@/features/catalog-admin/hooks/useProduct';
import { ErrorState } from '@/shared/ui/StatusState';
import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * Why this file exists: the product detail/edit page — base fields,
 * variants, and images all in one screen, since they're all facets of the
 * same product record an admin edits together. Base-field edits save
 * explicitly (a "Save Changes" button, not autosave-per-keystroke) so a
 * half-finished edit never silently commits.
 */
export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { product, isLoading, error, reload, updateProduct, archiveProduct, addVariant, updateVariant, deleteVariant, addImage, removeImage } =
    useProduct(id);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton height="2rem" width="40%" />
        <Skeleton height="12rem" />
      </div>
    );
  }

  if (error || !product) {
    return <ErrorState title="Couldn't load this product" description={error ?? 'Not found.'} actionLabel="Try again" onAction={reload} />;
  }

  async function handleArchive() {
    setIsArchiving(true);
    try {
      await archiveProduct();
      router.push('/admin/products');
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">{product.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={product.status} />
            <span className="text-sm text-ink-muted">{product.category.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsEditingDetails((v) => !v)}>
            {isEditingDetails ? 'Cancel Editing' : 'Edit Details'}
          </Button>
          <ArchiveButton onConfirm={handleArchive} isBusy={isArchiving} />
        </div>
      </div>

      <Card>
        {isEditingDetails ? (
          <ProductDetailsForm
            product={product}
            isSaving={isSaving}
            onSave={async (patch) => {
              setIsSaving(true);
              try {
                await updateProduct(patch);
                setIsEditingDetails(false);
              } finally {
                setIsSaving(false);
              }
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Slug" value={product.slug} />
            <Field label="Brand" value={product.brand?.name ?? '—'} />
            <Field label="Season" value={product.season ?? '—'} />
            <Field label="Flags" value={[product.isFeatured && 'Featured', product.isBestSeller && 'Best Seller', product.isNewArrival && 'New Arrival'].filter(Boolean).join(', ') || 'None'} />
            <div className="sm:col-span-2">
              <Field label="Description" value={product.description ?? '—'} />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Images</h2>
        <ImageManager productId={product.id} images={product.images} onAdd={addImage} onRemove={removeImage} />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Variants</h2>
        <VariantEditor
          variants={product.variants}
          onAdd={addVariant}
          onUpdate={(variantId, input) => updateVariant(variantId, input)}
          onDelete={deleteVariant}
        />
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}

function ArchiveButton({ onConfirm, isBusy }: { onConfirm: () => void; isBusy: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setIsOpen(true)}>Archive</Button>
      <ConfirmDialog
        isOpen={isOpen}
        title="Archive this product?"
        description="The product will be hidden from the storefront. This can be reversed later."
        confirmLabel="Archive"
        isBusy={isBusy}
        onConfirm={onConfirm}
        onCancel={() => setIsOpen(false)}
      />
    </>
  );
}

function ProductDetailsForm({
  product,
  isSaving,
  onSave,
}: {
  product: { name: string; description: string | null; status: string; season: string | null; isFeatured: boolean; isBestSeller: boolean; isNewArrival: boolean };
  isSaving: boolean;
  onSave: (patch: {
    name?: string;
    description?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    season?: 'WINTER' | 'SUMMER' | 'ALL_SEASON';
    isFeatured?: boolean;
    isBestSeller?: boolean;
    isNewArrival?: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');
  const [status, setStatus] = useState(product.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED');
  const [season, setSeason] = useState((product.season ?? '') as '' | 'WINTER' | 'SUMMER' | 'ALL_SEASON');
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [isBestSeller, setIsBestSeller] = useState(product.isBestSeller);
  const [isNewArrival, setIsNewArrival] = useState(product.isNewArrival);

  return (
    <div className="flex flex-col gap-4">
      <Input label="Product Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        <Select label="Season" value={season} onChange={(e) => setSeason(e.target.value as typeof season)}>
          <option value="">Not season-specific</option>
          <option value="WINTER">Winter</option>
          <option value="SUMMER">Summer</option>
          <option value="ALL_SEASON">All season</option>
        </Select>
      </div>
      <div className="flex flex-wrap gap-6 text-sm text-ink">
        <label className="flex items-center gap-2"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={isBestSeller} onChange={(e) => setIsBestSeller(e.target.checked)} /> Best Seller</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={isNewArrival} onChange={(e) => setIsNewArrival(e.target.checked)} /> New Arrival</label>
      </div>
      <Button
        className="self-start"
        isLoading={isSaving}
        onClick={() => onSave({ name, description, status, ...(season ? { season } : {}), isFeatured, isBestSeller, isNewArrival })}
      >
        Save Changes
      </Button>
    </div>
  );
}
