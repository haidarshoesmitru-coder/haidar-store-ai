import { NotFoundError, ConflictError, ValidationError } from '@/shared/lib/errors';

/**
 * Why this file exists: Sprint 2.2 asks for domain-specific errors
 * (CategoryAlreadyExists, ProductNotFound, DuplicateSKU, ...) while also
 * using "the existing shared error system." Both are true at once because
 * every class here EXTENDS a Sprint 1 error class rather than replacing
 * it — `error instanceof NotFoundError` still holds for
 * `ProductNotFoundError`, so `isAppError()` and `api-handler.ts` (both
 * untouched, both from Sprint 1) recognize and format these correctly
 * with zero changes to either file. This file is purely additive.
 *
 * Responsibility: name every domain-specific failure a catalog service
 * can throw, each pre-composed with the right message shape — a service
 * throws `new DuplicateSkuError(sku)`, never a generic
 * `new ConflictError('sku exists')` with an ad hoc string repeated at
 * every call site.
 *
 * Dependencies: shared/lib/errors.ts (Sprint 1, read-only).
 * Future usage: every service in this module; Sprint 2.3's API routes can
 * catch specific ones if they ever need different handling per error type
 * (they won't normally need to — api-handler.ts already formats any
 * AppError subtype correctly).
 */

export class CategoryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Category', id);
  }
}

export class SubCategoryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('SubCategory', id);
  }
}

export class BrandNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Brand', id);
  }
}

export class ProductNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Product', id);
  }
}

export class VariantNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('ProductVariant', id);
  }
}

export class CategoryAlreadyExistsError extends ConflictError {
  constructor(slug: string) {
    super(`A category with slug "${slug}" already exists.`);
  }
}

export class BrandAlreadyExistsError extends ConflictError {
  constructor(slug: string) {
    super(`A brand with slug "${slug}" already exists.`);
  }
}

export class ProductSlugAlreadyExistsError extends ConflictError {
  constructor(slug: string) {
    super(`A product with slug "${slug}" already exists.`);
  }
}

export class CategoryHasProductsError extends ConflictError {
  constructor(categoryId: string, productCount: number) {
    super(`Category ${categoryId} still has ${productCount} product(s) and cannot be deleted.`);
  }
}

export class CategoryHasSubCategoriesError extends ConflictError {
  constructor(categoryId: string, subCategoryCount: number) {
    super(`Category ${categoryId} still has ${subCategoryCount} subcategory(ies) and cannot be deleted.`);
  }
}

export class BrandInUseError extends ConflictError {
  constructor(brandId: string, productCount: number) {
    super(`Brand ${brandId} is still used by ${productCount} product(s) and cannot be deleted.`);
  }
}

export class DuplicateSkuError extends ConflictError {
  constructor(sku: string) {
    super(`A variant with SKU "${sku}" already exists.`);
  }
}

export class DuplicateBarcodeError extends ConflictError {
  constructor(barcode: string) {
    super(`A variant with barcode "${barcode}" already exists.`);
  }
}

export class InvalidBarcodeError extends ValidationError {
  constructor(barcode: string) {
    super('Invalid barcode format.', [
      { field: 'barcode', issue: `"${barcode}" is not a valid barcode (expected 8-14 digits).` },
    ]);
  }
}

export class InsufficientStockError extends ConflictError {
  constructor(variantId: string, requested: number, available: number) {
    super(
      `Cannot remove ${requested} unit(s) from variant ${variantId} — only ${available} available.`,
    );
  }
}

export class ProductMustHaveAtLeastOneVariantError extends ConflictError {
  constructor(productId: string) {
    super(`Product ${productId} must retain at least one variant.`);
  }
}
