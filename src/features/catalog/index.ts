/**
 * Public surface of the Catalog module.
 *
 * Why this file exists: Sprint 2.3's API routes (and any other future
 * consumer) should import from `@/features/catalog`, not reach into
 * `@/features/catalog/services/product.service.impl` or similar internal
 * paths directly. This is the boundary that makes it possible to
 * reorganize files inside this module later without breaking every
 * import across the codebase — only this file's exports are the contract.
 *
 * What's deliberately NOT exported: repository classes and interfaces.
 * Repositories are an implementation detail of the service layer;
 * nothing outside this module should construct or depend on one
 * directly. Route handlers depend on services, always.
 */

// Services — the module's actual public API
export { CategoryService, SubCategoryService } from '@/features/catalog/services/category.service.impl';
export { BrandService } from '@/features/catalog/services/brand.service.impl';
export { ProductService } from '@/features/catalog/services/product.service.impl';
export { VariantService, type IVariantService } from '@/features/catalog/services/variant.service';
export { InventoryService } from '@/features/catalog/services/inventory.service.impl';

// Service interfaces (Sprint 2.1 contracts) — for anything that wants to
// depend on the interface rather than the concrete class (tests, DI wiring).
export type { ICategoryService, ISubCategoryService } from '@/features/catalog/services/category.service';
export type { IBrandService } from '@/features/catalog/services/brand.service';
export type { IProductService } from '@/features/catalog/services/product.service';
export type { IInventoryService } from '@/features/catalog/services/inventory.service';

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

// DTO mapper functions
export { toCategoryDto, toSubCategoryDto, toCategoryWithSubCategoriesDto } from '@/features/catalog/dto/category.dto';
export { toBrandDto } from '@/features/catalog/dto/brand.dto';
export { toProductDto, toProductListItemDto } from '@/features/catalog/dto/product.dto';
export { toVariantDto, toVariantWithCostDto } from '@/features/catalog/dto/variant.dto';
export { toInventoryDto, toInventoryTransactionDto } from '@/features/catalog/dto/inventory.dto';

// Validation schemas — Sprint 2.1's composed input schemas
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

// Reusable field-level validators (Sprint 2.2)
export * from '@/features/catalog/validation/shared.schema';

// Route-layer validation (Sprint 2.3) — query-string and request-body schemas
// the DTO layer never needed, since Sprint 2.2 was service/repository scope.
export {
  paginationQuerySchema,
  productSearchQuerySchema,
  categoryListQuerySchema,
  brandListQuerySchema,
  variantListQuerySchema,
  inventoryHistoryQuerySchema,
} from '@/features/catalog/validation/route-query.schema';
export type { ProductSearchQuery } from '@/features/catalog/validation/route-query.schema';
export {
  stockInRequestSchema,
  stockOutRequestSchema,
  adjustInventoryRequestSchema,
} from '@/features/catalog/validation/inventory-request.schema';

// Product search service (Sprint 2.3) — the sort-aware, lightweight list/search query
export { ProductSearchService } from '@/features/catalog/services/product-search.service';
export type { ProductListRowDto } from '@/features/catalog/repositories/product-search.repository.impl';

// Attribute management (Sprint 2.4) — fills the gap flagged (not built) in Sprint 2.1/2.3
export { AttributeService } from '@/features/catalog/services/attribute.service.impl';
export { createAttributeSchema, type CreateAttributeInput } from '@/features/catalog/validation/attribute.validation';
export { AttributeAlreadyExistsError, AttributeNotFoundError } from '@/features/catalog/attribute-errors';

// Domain errors
export * from '@/features/catalog/errors';
