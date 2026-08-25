'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/features/catalog-admin/api-client';
import type { InventoryResponseDto, InventoryTransactionResponseDto } from '@/features/catalog';

/**
 * Why this file exists: the Inventory dashboard's data layer — low-stock
 * list, per-variant transaction history, and the three stock-mutation
 * actions, all against the real `/api/v1/inventory/*` endpoints (Sprint
 * 2.3).
 */

export function useLowStock() {
  const [items, setItems] = useState<InventoryResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<InventoryResponseDto[]>('/inventory/low-stock');
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load low-stock items.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, isLoading, error, reload };
}

export function useInventoryHistory(variantId: string | null) {
  const [transactions, setTransactions] = useState<InventoryTransactionResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!variantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<InventoryTransactionResponseDto[]>(`/inventory/${variantId}/history`, {
        limit: 50,
      });
      setTransactions(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load inventory history.');
    } finally {
      setIsLoading(false);
    }
  }, [variantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { transactions, isLoading, error, reload };
}

export async function stockIn(input: { variantId: string; quantity: number; note?: string }): Promise<void> {
  await apiClient.post('/inventory/stock-in', input);
}

export async function stockOut(input: { variantId: string; quantity: number; note?: string }): Promise<void> {
  await apiClient.post('/inventory/stock-out', input);
}

export async function adjustInventory(input: { variantId: string; quantityDelta: number; note: string }): Promise<void> {
  await apiClient.post('/inventory/adjust', input);
}
