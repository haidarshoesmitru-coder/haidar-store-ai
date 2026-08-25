'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiError } from '@/features/catalog-admin/api-client';
import type { ProductListRowDto } from '@/features/catalog';

export interface ProductFilters {
  q?: string;
  categoryId?: string;
  subCategoryId?: string;
  brandId?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  season?: 'WINTER' | 'SUMMER' | 'ALL_SEASON';
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'best_selling';
}

const PAGE_SIZE = 20;

/**
 * Why this file exists: the Products list page's data layer — search,
 * filter, sort, and cursor-paginate against `GET /api/v1/products`
 * (Sprint 2.3, powered by this sprint's `ProductSearchService`). Cursor
 * pagination is stack-based here (each "next" push the current cursor
 * onto a stack; "previous" pops it) so the admin table can offer familiar
 * Previous/Next controls despite the underlying API being cursor-only
 * (never offset) — a UI-layer convenience, not a change to how the API
 * paginates.
 */
export function useProducts(filters: ProductFilters) {
  const [products, setProducts] = useState<ProductListRowDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const cursorStack = useRef<(string | undefined)[]>([undefined]);

  const filtersKey = JSON.stringify(filters);

  const fetchPage = useCallback(async (cursor: string | undefined) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, meta } = await apiClient.get<ProductListRowDto[]>('/products', {
        ...filters,
        cursor,
        limit: PAGE_SIZE,
      });
      setProducts(data);
      const pagination = meta?.pagination as { nextCursor: string | null; hasMore: boolean } | undefined;
      setHasMore(pagination?.hasMore ?? false);
      if (pagination?.hasMore && pagination.nextCursor) {
        cursorStack.current[pageIndex + 1] = pagination.nextCursor;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load products.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, pageIndex]);

  // Filters changed — reset to page 0.
  useEffect(() => {
    cursorStack.current = [undefined];
    setPageIndex(0);
    void fetchPage(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const nextPage = useCallback(() => {
    if (!hasMore) return;
    const next = pageIndex + 1;
    setPageIndex(next);
    void fetchPage(cursorStack.current[next]);
  }, [hasMore, pageIndex, fetchPage]);

  const previousPage = useCallback(() => {
    if (pageIndex === 0) return;
    const prev = pageIndex - 1;
    setPageIndex(prev);
    void fetchPage(cursorStack.current[prev]);
  }, [pageIndex, fetchPage]);

  const refetch = useCallback(() => fetchPage(cursorStack.current[pageIndex]), [fetchPage, pageIndex]);

  return {
    products,
    isLoading,
    error,
    hasMore,
    hasPrevious: pageIndex > 0,
    nextPage,
    previousPage,
    refetch,
  };
}
