'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/features/catalog-admin/api-client';
import type { CategoryWithSubCategoriesResponseDto, CreateCategoryDto, UpdateCategoryDto } from '@/features/catalog/client';

/**
 * Why this file exists: the Categories admin page's data layer — list,
 * create, update, delete, all backed by the real `/api/v1/categories`
 * endpoints (Sprint 2.3), with local state kept in sync after each
 * mutation rather than requiring a manual page refresh.
 */
export function useCategories() {
  const [categories, setCategories] = useState<CategoryWithSubCategoriesResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<CategoryWithSubCategoriesResponseDto[]>('/categories');
      setCategories(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createCategory = useCallback(
    async (input: CreateCategoryDto) => {
      await apiClient.post('/categories', input);
      await reload();
    },
    [reload],
  );

  const updateCategory = useCallback(
    async (id: string, input: UpdateCategoryDto) => {
      await apiClient.patch(`/categories/${id}`, input);
      await reload();
    },
    [reload],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      await apiClient.delete(`/categories/${id}`);
      await reload();
    },
    [reload],
  );

  return { categories, isLoading, error, reload, createCategory, updateCategory, deleteCategory };
}
