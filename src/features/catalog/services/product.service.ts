import type { ProductImage } from '@prisma/client';
import type { ProductWithRelations, CursorPage } from '@/features/catalog/types';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductImageInput,
  ProductListQuery,
} from '@/features/catalog/validation/product.validation';

/**
 * Why this file exists: the service contract for Product. The important
 * design decision it encodes is orchestration ownership — `create()` takes
 * the full `CreateProductInput` (product fields + a `variants` array) and
 * is responsible for:
 *   1. validating categoryId/subCategoryId/brandId reference real, active rows
 *      (via ICategoryService/IBrandService — not by querying Prisma directly)
 *   2. creating the Product row
 *   3. creating each variant via IProductVariantRepository
 *   4. initializing an Inventory row (via IInventoryRepository) for every
 *      variant created, seeded from that variant's `initialQuantity`
 *   5. ensuring exactly one variant ends up `isDefault: true`
 *
 * All of that happens in one service method, in one DB transaction — not
 * as a sequence of independent repository calls a route handler
 * coordinates. This is precisely the kind of business rule the
 * architecture's "no business logic in API routes" constraint exists to
 * keep out of the (not-yet-built) route handler.
 *
 * Dependencies: catalog/types.ts, product.validation.ts.
 * Future usage: implemented in Sprint 2.2, depended on by the future
 * Product API routes and, eventually, the AI Content Studio (which
 * updates `description` through this same service, not a direct repo call).
 */
export interface IProductService {
  getById(id: string): Promise<ProductWithRelations | null>;
  getBySlug(slug: string): Promise<ProductWithRelations | null>;
  list(query: ProductListQuery): Promise<CursorPage<ProductWithRelations>>;

  /** Orchestrates product + variant(s) + inventory creation — see file header. */
  create(input: CreateProductInput): Promise<ProductWithRelations>;
  update(id: string, input: UpdateProductInput): Promise<ProductWithRelations>;
  /** Sets status ARCHIVED and deletedAt — never a hard delete. */
  archive(id: string): Promise<void>;

  addImage(productId: string, input: ProductImageInput): Promise<ProductImage>;
  removeImage(productId: string, imageId: string): Promise<void>;
}
