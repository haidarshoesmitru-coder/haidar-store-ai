'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/features/catalog-admin/api-client';
import type { CreateAttributeInput } from '@/features/catalog/client';

export interface AttributeDto {
  id: string;
  name: string;
  code: string;
  dataType: string;
}

/**
 * Why this file exists: data layer for the new Attribute API (added this
 * sprint to fill the gap noted since Sprint 2.1) — powers the
 * dynamic-attribute picker in ProductForm.
 */
export function useAttributes() {
  const [attributes, setAttributes] = useState<AttributeDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<AttributeDto[]>('/attributes');
      setAttributes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load attributes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createAttribute = useCallback(async (input: CreateAttributeInput) => {
    const { data } = await apiClient.post<AttributeDto>('/attributes', input);
    await reload();
    return data;
  }, [reload]);

  return { attributes, isLoading, error, reload, createAttribute };
}
