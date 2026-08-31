'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/shared/ui/Button';
import { DataTable, type DataTableColumn } from '@/features/catalog-admin/components/DataTable';
import { Pagination } from '@/features/catalog-admin/components/Pagination';
import { SearchInput } from '@/features/catalog-admin/components/SearchInput';
import { Select } from '@/features/catalog-admin/components/FormFields';
import { StatusBadge } from '@/features/catalog-admin/components/StatusBadge';
import { useProducts, type ProductFilters } from '@/features/catalog-admin/hooks/useProducts';
import { useDebouncedValue } from '@/features/catalog-admin/hooks/useDebouncedValue';
import { useCategories } from '@/features/catalog-admin/hooks/useCategories';
import { useBrands } from '@/features/catalog-admin/hooks/useBrands';
import type { ProductListRowDto } from '@/features/catalog/client';

/**
 * Why this file exists: the Products list page — search, filter
 * (category/brand/status/featured/best-seller/new-arrival), sort, and
 * cursor-paginate against the real `GET /api/v1/products` endpoint
 * (Sprint 2.3, powered by this sprint's sort-aware search repository).
 */
export default function ProductsPage() {
  const { categories } = useCategories();
  const { brands } = useBrands();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [status, setStatus] = useState('');
  const [flag, setFlag] = useState<'' | 'isFeatured' | 'isBestSeller' | 'isNewArrival'>('');
  const [sort, setSort] = useState<NonNullable<ProductFilters['sort']>>('newest');

  const filters: ProductFilters = useMemo(
    () => ({
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(status ? { status: status as NonNullable<ProductFilters['status']> } : {}),
      sort,
      ...(flag ? { [flag]: true } : {}),
    }),
    [debouncedSearch, categoryId, brandId, status, sort, flag],
  );

  const { products, isLoading, error, hasMore, hasPrevious, nextPage, previousPage, refetch } = useProducts(filters);

  const columns: DataTableColumn<ProductListRowDto>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (p) => (
        <Link href={`/admin/products/${p.id}`} className="font-medium text-ink hover:text-accent">
          {p.name}
        </Link>
      ),
    },
    { key: 'category', header: 'Category', render: (p) => p.categoryName },
    { key: 'brand', header: 'Brand', render: (p) => p.brandName ?? '—' },
    { key: 'price', header: 'Starting Price', render: (p) => (p.startingPrice ? `Rs. ${p.startingPrice}` : '—') },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'flags',
      header: 'Flags',
      render: (p) => (
        <div className="flex gap-1 text-xs text-ink-muted">
          {p.isFeatured ? <span title="Featured">⭐</span> : null}
          {p.isBestSeller ? <span title="Best Seller">🏆</span> : null}
          {p.isNewArrival ? <span title="New Arrival">🆕</span> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display">Products</h1>
        <Link href="/admin/products/new">
          <Button>+ Add Product</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products…" />
        <div className="w-40">
          <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select label="Brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">All</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </div>
        <div className="w-36">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
        <div className="w-40">
          <Select label="Highlight" value={flag} onChange={(e) => setFlag(e.target.value as typeof flag)}>
            <option value="">None</option>
            <option value="isFeatured">Featured</option>
            <option value="isBestSeller">Best Seller</option>
            <option value="isNewArrival">New Arrival</option>
          </Select>
        </div>
        <div className="w-40">
          <Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value as NonNullable<ProductFilters['sort']>)}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="best_selling">Best Selling</option>
          </Select>
        </div>
      </div>

      <div>
        <DataTable
          columns={columns}
          rows={products}
          rowKey={(p) => p.id}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyTitle="No products found"
          emptyDescription="Try adjusting your search or filters."
        />
        <Pagination hasPrevious={hasPrevious} hasMore={hasMore} onPrevious={previousPage} onNext={nextPage} isLoading={isLoading} />
      </div>
    </div>
  );
}
