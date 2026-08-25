'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/shared/ui/Card';
import { ProductForm } from '@/features/catalog-admin/forms/ProductForm';
import { createProduct } from '@/features/catalog-admin/hooks/useProduct';
import { apiClient } from '@/features/catalog-admin/api-client';

/** New Product page — creates the product (+ default variant) via POST /api/v1/products, then optionally sets the low-stock threshold. */
export default function NewProductPage() {
  const router = useRouter();

  async function handleSubmit(input: Parameters<typeof createProduct>[0], lowStockThreshold: number | null) {
    const product = await createProduct(input);
    const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
    if (lowStockThreshold !== null && defaultVariant) {
      await apiClient.put(`/inventory/${defaultVariant.id}/low-stock-config`, { threshold: lowStockThreshold, isEnabled: true });
    }
    router.push(`/admin/products/${product.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display">New Product</h1>
      <Card>
        <ProductForm onSubmit={handleSubmit} onCancel={() => router.push('/admin/products')} />
      </Card>
    </div>
  );
}
