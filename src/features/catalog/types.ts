import type {
  Category,
  SubCategory,
  Brand,
  Product,
  ProductImage,
  ProductVariant,
  Attribute,
  VariantAttribute,
  Inventory,
  InventoryTransaction,
  LowStockConfiguration,
  ProductStatus,
  ProductSeason,
  VariantStatus,
  AttributeDataType,
  InventoryTransactionType,
} from '@prisma/client';

/**
 * Why this file exists: the rest of the module (repositories, services,
 * validation) is written against these shapes, not raw Prisma types
 * directly. Two concrete reasons this matters here specifically:
 *   1. `ProductVariant.costPrice` must never reach a `staff`-level caller
 *      (per the RBAC margin-visibility rule from the API architecture) —
 *      `VariantSummary` below is the safe shape that omits it; the raw
 *      Prisma type doesn't have that distinction.
 *   2. Read shapes commonly need related data attached (a product with its
 *      variants and images loaded) — these composite types name that
 *      shape once instead of every consumer writing its own inline
 *      `Product & { variants: ... }` type.
 *
 * Dependencies: @prisma/client (type-only).
 * Future usage: every file in repositories/, services/, and validation/ in
 * this module imports from here rather than from @prisma/client directly.
 */

// Re-exported so consumers of this module import enums from one place.
export type { ProductStatus, ProductSeason, VariantStatus, AttributeDataType, InventoryTransactionType };

/** A single variant-defining value, hydrated with its attribute definition. */
export interface VariantAttributeWithDefinition extends VariantAttribute {
  attribute: Attribute;
}

/** A variant shape safe to return to any authenticated role — no cost price. */
export type VariantSummary = Omit<ProductVariant, 'costPrice'> & {
  attributes: VariantAttributeWithDefinition[];
  inventory: Inventory | null;
};

/** The same variant, with cost price included — manager/admin callers only. */
export type VariantWithCost = ProductVariant & {
  attributes: VariantAttributeWithDefinition[];
  inventory: Inventory | null;
};

/** A product with its images and variants loaded — the shape a product detail view needs. */
export interface ProductWithRelations extends Product {
  category: Category;
  subCategory: SubCategory | null;
  brand: Brand | null;
  images: ProductImage[];
  variants: VariantSummary[];
}

/** A category with its subcategories loaded — for nav/tree rendering. */
export interface CategoryWithSubCategories extends Category {
  subCategories: SubCategory[];
}

/** Inventory plus its threshold config — the shape a stock dashboard needs. */
export interface InventoryWithConfig extends Inventory {
  lowStockConfig: LowStockConfiguration | null;
}

export type { InventoryTransaction };

/** Cursor pagination result shape, consistent with the API architecture's §19. */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
