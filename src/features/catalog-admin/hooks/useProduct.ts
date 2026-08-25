'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/features/catalog-admin/api-client';
import type {
  ProductResponseDto,
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
  VariantWithCostResponseDto,
} from '@/features/catalog';

/**
 * Why this file exists: the single-product admin page's data layer —
 * fetch, update, archive a product, plus every variant and image mutation
 * scoped to it. All against the real `/api/v1/products/*` endpoints
 * (Sprint 2.3) and the new `/api/v1/products/:id/images` endpoints (this
 * sprint). Reloads the full product after every mutation so the UI never
 * drifts from server state.
 */
export function useProduct(productId: string | null) {
  const [product, setProduct] = useState<ProductResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(productId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<ProductResponseDto>(`/products/${productId}`);
      setProduct(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load product.');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateProduct = useCallback(async (input: UpdateProductDto) => {
    if (!productId) return;
    await apiClient.patch(`/products/${productId}`, input);
    await reload();
  }, [productId, reload]);

  const archiveProduct = useCallback(async () => {
    if (!productId) return;
    await apiClient.delete(`/products/${productId}`);
  }, [productId]);

  const addVariant = useCallback(async (input: CreateVariantDto) => {
    if (!productId) return;
    await apiClient.post(`/products/${productId}/variants`, input);
    await reload();
  }, [productId, reload]);

  const updateVariant = useCallback(async (variantId: string, input: UpdateVariantDto) => {
    if (!productId) return;
    await apiClient.patch(`/products/${productId}/variants/${variantId}`, input);
    await reload();
  }, [productId, reload]);

  const deleteVariant = useCallback(async (variantId: string) => {
    if (!productId) return;
    await apiClient.delete(`/products/${productId}/variants/${variantId}`);
    await reload();
  }, [productId, reload]);

  const getVariantWithCost = useCallback(async (variantId: string) => {
    if (!productId) return null;
    const { data } = await apiClient.get<VariantWithCostResponseDto>(`/products/${productId}/variants/${variantId}`);
    return data;
  }, [productId]);

  const addImage = useCallback(async (url: string, isPrimary: boolean, sortOrder: number) => {
    if (!productId) return;
    await apiClient.post(`/products/${productId}/images`, { url, isPrimary, sortOrder });
    await reload();
  }, [productId, reload]);

  const removeImage = useCallback(async (imageId: string) => {
    if (!productId) return;
    await apiClient.delete(`/products/${productId}/images/${imageId}`);
    await reload();
  }, [productId, reload]);

  return {
    product,
    isLoading,
    error,
    reload,
    updateProduct,
    archiveProduct,
    addVariant,
    updateVariant,
    deleteVariant,
    getVariantWithCost,
    addImage,
    removeImage,
  };
}

/** Standalone create — used by the "New Product" page, which has no productId yet. */
export async function createProduct(input: CreateProductDto): Promise<ProductResponseDto> {
  const { data } = await apiClient.post<ProductResponseDto>('/products', input);
  return data;
}
