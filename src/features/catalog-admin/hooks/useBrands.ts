'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/features/catalog-admin/api-client';
import type { BrandResponseDto, CreateBrandDto, UpdateBrandDto } from '@/features/catalog';

/** Same pattern as useCategories.ts — see there for the shared rationale. */
export function useBrands() {
  const [brands, setBrands] = useState<BrandResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<BrandResponseDto[]>('/brands');
      setBrands(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load brands.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createBrand = useCallback(async (input: CreateBrandDto) => {
    await apiClient.post('/brands', input);
    await reload();
  }, [reload]);

  const updateBrand = useCallback(async (id: string, input: UpdateBrandDto) => {
    await apiClient.patch(`/brands/${id}`, input);
    await reload();
  }, [reload]);

  const deleteBrand = useCallback(async (id: string) => {
    await apiClient.delete(`/brands/${id}`);
    await reload();
  }, [reload]);

  return { brands, isLoading, error, reload, createBrand, updateBrand, deleteBrand };
}
