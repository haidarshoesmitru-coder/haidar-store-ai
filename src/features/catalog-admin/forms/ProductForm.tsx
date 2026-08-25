'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, Textarea } from '@/features/catalog-admin/components/FormFields';
import { useCategories } from '@/features/catalog-admin/hooks/useCategories';
import { useBrands } from '@/features/catalog-admin/hooks/useBrands';
import { useAttributes } from '@/features/catalog-admin/hooks/useAttributes';
import { createProductSchema } from '@/features/catalog';
import { ApiError } from '@/features/catalog-admin/api-client';
import type { CreateProductDto } from '@/features/catalog';

/**
 * Why this file exists: the "New Product" form. Collects the product's
 * base fields AND its first (default) variant in one screen — SKU,
 * barcode, price, purchase price, and initial stock are all genuinely
 * variant-level fields in this schema (Sprint 2.1's deliberate design:
 * price/stock live on ProductVariant, not Product, so one shape works for
 * both a single-variant makeup item and an eight-variant shoe), but the
 * task's form spec lists them alongside product fields — this form
 * presents them together as one create flow and maps them into
 * `CreateProductDto.variants[0]` on submit. Additional variants (a second
 * size, a second color) are added afterward on the product edit page via
 * VariantEditor, matching how a real catalog admin actually works: create
 * the product with its first sellable option, then add more.
 *
 * Dynamic attributes: `CATEGORY_ATTRIBUTE_HINTS` below is a CLIENT-SIDE
 * suggestion table only — Sprint 2.1's schema has no `CategoryAttribute`
 * governance table (flagged as a known gap in that sprint's own docs), so
 * there is no backend rule saying "Shoes must have a Size attribute." This
 * hint list just pre-filters which existing attributes are suggested
 * first based on the selected category's name; the admin can still add
 * ANY attribute to ANY product. A future sprint building real
 * category-attribute governance would replace this with a server-driven
 * list.
 *
 * Low stock threshold is submitted as a SEPARATE API call after the
 * product/variant is created (the new `PUT
 * /api/v1/inventory/:variantId/low-stock-config` endpoint needs a real
 * variantId, which doesn't exist until the variant is created) — not a
 * flaw, just the natural consequence of threshold config being its own
 * entity (Sprint 2.1's deliberate config-vs-state separation).
 */

const CATEGORY_ATTRIBUTE_HINTS: Record<string, string[]> = {
  shoe: ['size', 'color', 'material'],
  jewel: ['weight', 'material'],
  makeup: ['shade', 'volume'],
  general: ['pack_size', 'expiry'],
};

interface ProductFormProps {
  onSubmit: (input: CreateProductDto, lowStockThreshold: number | null) => Promise<void>;
  onCancel: () => void;
}

interface AttributeRow {
  attributeId: string;
  value: string;
}

export function ProductForm({ onSubmit, onCancel }: ProductFormProps) {
  const { categories } = useCategories();
  const { brands } = useBrands();
  const { attributes, createAttribute } = useAttributes();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT');
  const [season, setSeason] = useState<'' | 'WINTER' | 'SUMMER' | 'ALL_SEASON'>('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(false);

  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('');

  const [attributeRows, setAttributeRows] = useState<AttributeRow[]>([]);
  const [newAttributeName, setNewAttributeName] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCategory = categories.find((category) => category.id === categoryId);

  const suggestedAttributeIds = useMemo(() => {
    if (!selectedCategory) return [];
    const key = Object.keys(CATEGORY_ATTRIBUTE_HINTS).find((hint) => selectedCategory.name.toLowerCase().includes(hint));
    const codes = key ? CATEGORY_ATTRIBUTE_HINTS[key] : undefined;
    if (!codes) return [];
    return attributes.filter((attribute) => codes.includes(attribute.code)).map((attribute) => attribute.id);
  }, [selectedCategory, attributes]);

  function addAttributeRow(attributeId = '') {
    setAttributeRows((rows) => [...rows, { attributeId, value: '' }]);
  }

  function updateAttributeRow(index: number, patch: Partial<AttributeRow>) {
    setAttributeRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeAttributeRow(index: number) {
    setAttributeRows((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleCreateAttribute() {
    if (!newAttributeName.trim()) return;
    const code = newAttributeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const attribute = await createAttribute({ name: newAttributeName.trim(), code, dataType: 'TEXT' });
    addAttributeRow(attribute.id);
    setNewAttributeName('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const candidate: CreateProductDto = {
      categoryId,
      subCategoryId: subCategoryId || undefined,
      brandId: brandId || undefined,
      name,
      slug,
      description: description || undefined,
      status,
      season: season || undefined,
      isFeatured,
      isBestSeller,
      isNewArrival,
      variants: [
        {
          sku: sku || undefined,
          barcode: barcode || undefined,
          price: Number(price),
          costPrice: costPrice ? Number(costPrice) : undefined,
          isDefault: true,
          initialQuantity: Number(initialQuantity) || 0,
          attributes: attributeRows.filter((row) => row.attributeId && row.value.trim()),
        },
      ],
    };

    const result = createProductSchema.safeParse(candidate);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[issue.path.join('.')] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      const threshold = lowStockThreshold ? Number(lowStockThreshold) : null;
      await onSubmit(result.data, threshold);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Product Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} error={errors.slug} hint="Lowercase, hyphen-separated" required />

        <Select label="Category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubCategoryId(''); }} error={errors.categoryId} required>
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>

        <Select label="Subcategory (optional)" value={subCategoryId} onChange={(e) => setSubCategoryId(e.target.value)} disabled={!selectedCategory}>
          <option value="">None</option>
          {selectedCategory?.subCategories.map((sub) => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </Select>

        <Select label="Brand (optional)" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">None</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </Select>

        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </Select>

        <Select label="Season (optional)" value={season} onChange={(e) => setSeason(e.target.value as typeof season)}>
          <option value="">Not season-specific</option>
          <option value="WINTER">Winter</option>
          <option value="SUMMER">Summer</option>
          <option value="ALL_SEASON">All season</option>
        </Select>
      </section>

      <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />

      <div className="flex flex-wrap gap-6 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isBestSeller} onChange={(e) => setIsBestSeller(e.target.checked)} /> Best Seller
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isNewArrival} onChange={(e) => setIsNewArrival(e.target.checked)} /> New Arrival
        </label>
      </div>

      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">Default Variant</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="SKU / Article Number (optional)" value={sku} onChange={(e) => setSku(e.target.value)} error={errors['variants.0.sku']} />
          <Input label="Barcode (optional)" value={barcode} onChange={(e) => setBarcode(e.target.value)} error={errors['variants.0.barcode']} />
          <Input label="Selling Price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} error={errors['variants.0.price']} required />
          <Input label="Purchase Price (optional)" type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} error={errors['variants.0.costPrice']} />
          <Input label="Initial Stock" type="number" value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} error={errors['variants.0.initialQuantity']} />
          <Input label="Low Stock Threshold (optional)" type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} hint="Alerts when stock falls to or below this number." />
        </div>

        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-ink">Attributes</h4>
          {suggestedAttributeIds.length > 0 && attributeRows.length === 0 ? (
            <p className="mb-2 text-xs text-ink-muted">
              Suggested for {selectedCategory?.name}: {suggestedAttributeIds.map((id) => attributes.find((a) => a.id === id)?.name).filter(Boolean).join(', ')}
            </p>
          ) : null}

          {attributeRows.map((row, index) => (
            <div key={index} className="mb-2 flex items-end gap-2">
              <div className="flex-1">
                <Select label="Attribute" value={row.attributeId} onChange={(e) => updateAttributeRow(index, { attributeId: e.target.value })}>
                  <option value="">Select an attribute</option>
                  {attributes.map((attribute) => (
                    <option key={attribute.id} value={attribute.id}>{attribute.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Input label="Value" value={row.value} onChange={(e) => updateAttributeRow(index, { value: e.target.value })} />
              </div>
              <Button type="button" variant="ghost" onClick={() => removeAttributeRow(index)}>Remove</Button>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => addAttributeRow()}>
              + Add Attribute
            </Button>
            {suggestedAttributeIds
              .filter((id) => !attributeRows.some((row) => row.attributeId === id))
              .map((id) => (
                <Button key={id} type="button" variant="ghost" size="sm" onClick={() => addAttributeRow(id)}>
                  + {attributes.find((a) => a.id === id)?.name}
                </Button>
              ))}
          </div>

          <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
            <div className="flex-1">
              <Input label="New attribute name (e.g. Sleeve Length)" value={newAttributeName} onChange={(e) => setNewAttributeName(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleCreateAttribute} disabled={!newAttributeName.trim()}>
              Create Attribute
            </Button>
          </div>
        </div>
      </section>

      {formError ? <p className="text-sm text-error">{formError}</p> : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Create Product
        </Button>
      </div>
    </form>
  );
}
