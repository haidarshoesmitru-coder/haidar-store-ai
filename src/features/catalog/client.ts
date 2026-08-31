/**
 * Client-safe public surface of the Catalog module.
 *
 * Why this file exists: `@/features/catalog/index.ts` (the full barrel)
 * re-exports service classes (CategoryService, ProductService, etc.)
 * alongside types/DTOs/schemas. Those services import repositories, which
 * import Prisma — and Prisma's runtime needs Node's `fs` module, which
 * doesn't exist in a browser. A 'use client' component that imports
 * ANYTHING as a value (not `import type`) from the full barrel forces
 * the bundler to evaluate that whole module graph, dragging Prisma into
 * the client bundle and crashing the build ("Module not found: Can't
 * resolve 'fs'").
 *
 * This file re-exports only what's actually safe to run in a browser:
 * types, DTOs, pure mapper functions, and Zod validation schemas — none
 * of it touches Prisma, directly or transitively. Every client component
 * under catalog-admin/ imports from here instead of the full barrel,
 * even for type-only imports — so a future value-import added to this
 * file can never accidentally reintroduce the bug, because this file's
 * own export list is the guarantee, not each call site's discipline
 * about using `import type`.
 *
 * The full barrel (`@/features/catalog`) remains what server-side code —
 * API routes, other services — imports from; nothing here replaces that.
 */

// Domain types
export type {
  ProductWithRelations,
  VariantSummary,
  VariantWithCost,
  CategoryWithSubCategories,
  InventoryWithConfig,
  CursorPage,
} from '@/features/catalog/types';

// DTOs
export type { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto, CategoryWithSubCategoriesResponseDto, SubCategoryResponseDto } from '@/features/catalog/dto/category.dto';
export type { CreateBrandDto, UpdateBrandDto, BrandResponseDto } from '@/features/catalog/dto/brand.dto';
export type { CreateProductDto, UpdateProductDto, ProductResponseDto, ProductListItemDto, ProductSearchDto, ProductImageDto } from '@/features/catalog/dto/product.dto';
export type { CreateVariantDto, UpdateVariantDto, VariantResponseDto, VariantWithCostResponseDto } from '@/features/catalog/dto/variant.dto';
export type { StockInDto, StockOutDto, AdjustInventoryDto, InventoryResponseDto, InventoryTransactionResponseDto } from '@/features/catalog/dto/inventory.dto';
export type { PaginationParamsDto, PaginatedResponseDto, SearchParamsDto } from '@/features/catalog/dto/pagination.dto';

// Validation schemas — safe to run client-side (e.g. for optimistic
// client-side validation before hitting the API), pure Zod, no Prisma.
export {
  createCategorySchema,
  updateCategorySchema,
  createSubCategorySchema,
  updateSubCategorySchema,
} from '@/features/catalog/validation/category.validation';
export { createBrandSchema, updateBrandSchema } from '@/features/catalog/validation/brand.validation';
export {
  createProductSchema,
  updateProductSchema,
  productImageInputSchema,
  productListQuerySchema,
} from '@/features/catalog/validation/product.validation';
export {
  createVariantSchema,
  updateVariantSchema,
  variantAttributeInputSchema,
} from '@/features/catalog/validation/variant.validation';
export {
  recordInventoryTransactionSchema,
  setLowStockConfigurationSchema,
} from '@/features/catalog/validation/inventory.validation';

export { createAttributeSchema, type CreateAttributeInput } from '@/features/catalog/validation/attribute.validation';

// Product search — types only (ProductSearchService itself touches
// Prisma via its repository and stays server-only)
export type { ProductListRowDto } from '@/features/catalog/repositories/product-search.repository.impl';
