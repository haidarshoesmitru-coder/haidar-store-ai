import type { Product, ProductImage } from '@prisma/client';
import type { ProductWithRelations, CursorPage } from '@/features/catalog/types';
import type { ProductListQuery } from '@/features/catalog/validation/product.validation';

/**
 * Why this file exists: contract for Product + ProductImage — grouped
 * together (not split into two repositories) because ProductImage has no
 * independent lifecycle: an image only ever exists in the context of a
 * product, so it's managed through this repository rather than getting
 * its own. See category.repository.ts for the general repository-contract
 * rationale.
 *
 * Dependencies: @prisma/client (types only), catalog/types.ts,
 * product.validation.ts (for the list-query shape).
 * Future usage: implemented in Sprint 2.2; depended on by IProductService.
 */
export interface IProductRepository {
  findById(id: string): Promise<ProductWithRelations | null>;
  findBySlug(slug: string): Promise<ProductWithRelations | null>;
  /** Cursor-paginated list per the API architecture's §19 — never offset-based. */
  findMany(query: ProductListQuery): Promise<CursorPage<ProductWithRelations>>;
  create(input: Omit<Product, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>): Promise<Product>;
  update(id: string, input: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Product>;
  /** Soft delete — sets deletedAt and, per the DB design, the service layer maps this to status ARCHIVED. */
  softDelete(id: string): Promise<void>;

  addImage(input: Omit<ProductImage, 'id' | 'createdAt'>): Promise<ProductImage>;
  removeImage(imageId: string): Promise<void>;
}
