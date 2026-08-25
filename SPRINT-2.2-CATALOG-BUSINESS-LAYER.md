# Sprint 2.2 — Catalog Business Layer

Sprint 1 and Sprint 2.1 are untouched — verified by grep before packaging (no `export class` landed
in any file that was interface-only in Sprint 2.1, and `prisma/schema.prisma` has no diff from
Sprint 2.1). Everything below is new.

---

## 1. A Real Naming Conflict, and How It Was Resolved

This sprint's requested folder structure names concrete files identically to Sprint 2.1's
*interface* files — `repositories/category.repository.ts`, `services/product.service.ts`, etc.
already exist and are not to be modified. Two options existed: overwrite them (violates "do not
modify Sprint 2.1"), or find a naming convention that adds rather than replaces. I used a
consistent `.impl.ts` suffix for the four repositories/services that collide by name
(`category`, `brand`, `product`, `inventory`) and a `variant.repository.impl.ts` /
`variant.service.ts` pair for the one entity Sprint 2.1 named differently (`product-variant`):

```
repositories/
  category.repository.ts        Sprint 2.1 — interface (untouched)
  category.repository.impl.ts   Sprint 2.2 — PrismaCategoryRepository, PrismaSubCategoryRepository
  brand.repository.ts           Sprint 2.1 — interface (untouched)
  brand.repository.impl.ts      Sprint 2.2 — PrismaBrandRepository
  product.repository.ts         Sprint 2.1 — interface (untouched)
  product.repository.impl.ts    Sprint 2.2 — PrismaProductRepository
  product-variant.repository.ts Sprint 2.1 — interface (untouched, original name kept)
  variant.repository.impl.ts    Sprint 2.2 — PrismaProductVariantRepository (this sprint's requested "variant" name)
  inventory.repository.ts       Sprint 2.1 — interface (untouched)
  inventory.repository.impl.ts  Sprint 2.2 — PrismaInventoryRepository

services/
  category.service.ts        Sprint 2.1 — interface (untouched)
  category.service.impl.ts   Sprint 2.2 — CategoryService, SubCategoryService
  brand.service.ts / brand.service.impl.ts       (same pattern)
  product.service.ts / product.service.impl.ts   (same pattern)
  variant.service.ts         Sprint 2.2 — genuinely new: IVariantService + VariantService in
                              one file, since Sprint 2.1 had no separate variant service (variant
                              concerns were folded into IProductService's aggregate boundary).
                              No collision, no `.impl` suffix needed.
  inventory.service.ts / inventory.service.impl.ts  (same pattern)
```

If this reads as unusual, that's the honest reflection of a real constraint: this sprint's
requested structure and the prior sprint's actual file names disagree, and "do not modify Sprint
2.1" has to win. The `.impl` suffix is a standard enough convention (interface/implementation
split) that it shouldn't surprise anyone maintaining this later.

## 2. The Extended-Interface Pattern

Sprint 2.1's interfaces (`ICategoryRepository`, etc.) don't have methods like `existsBySlug` or
`countProducts` — this sprint's business rules (duplicate-slug checks, has-products checks) need
them. Rather than casting a repository to its concrete class to reach those methods (which would
compile even against a fake/test repository missing them — an unsafe pattern I wrote first and
then corrected), every `*.repository.impl.ts` file exports an `I*RepositoryExtended` interface:

```ts
export interface ICategoryRepositoryExtended extends ICategoryRepository {
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  countProducts(categoryId: string): Promise<number>;
  countSubCategories(categoryId: string): Promise<number>;
}
```

Services depend on the extended interface type, never on the concrete class or an `as` cast. This
is purely additive — `ICategoryRepository` itself (Sprint 2.1's file) is never touched — and it
means a future test double only needs to implement the small number of extra methods a given
service actually calls.

## 3. Method-Naming Reconciliation

Sprint 2.1's service interfaces use `create`/`update`/`archive`; this sprint's spec asks for
`createCategory`/`updateCategory`/`deleteCategory` (and the product/variant/inventory equivalents).
Every concrete service class exposes **both**: the sprint-2.2-named methods are the real
implementations; the Sprint-2.1-named methods are one-line aliases at the bottom of each class
(`create(input) { return this.createCategory(input); }`). This satisfies `implements IXService`
(so anything written against the Sprint 2.1 contract still works) while making this sprint's
requested names the primary, documented public API.

## 4. Business Rules — Where Each One Lives

| Rule | Enforced in | Error thrown |
|---|---|---|
| Duplicate category/subcategory/brand/product slug | `*Service.create*`/`update*` | `CategoryAlreadyExistsError`, `BrandAlreadyExistsError`, `ProductSlugAlreadyExistsError` |
| Duplicate SKU | `VariantService.assertNoDuplicates` | `DuplicateSkuError` |
| Duplicate barcode | `VariantService.assertNoDuplicates` | `DuplicateBarcodeError` |
| Barcode format | `VariantService.assertNoDuplicates` (see §6 gap below) | `InvalidBarcodeError` |
| Prevent deleting a category with products | `CategoryService.deleteCategory` | `CategoryHasProductsError` |
| Prevent deleting a category with subcategories | `CategoryService.deleteCategory` | `CategoryHasSubCategoriesError` (added — not explicitly named in the spec, a direct consequence of the same "don't orphan children" principle applied to subcategories, not just products) |
| Prevent deleting a brand still in use | `BrandService.deleteBrand` | `BrandInUseError` |
| Prevent negative stock | `InventoryService.applyTransaction` (the one method every stock mutation funnels through) | `InsufficientStockError` |
| Every stock change produces a transaction record | `InventoryService.applyTransaction` — `recordTransaction` (the repository's single write path) is called exactly once, from exactly one place in this service | — |
| Product must retain ≥1 variant | Enforced twice, deliberately: Zod (`variants.min(1)`) at product-creation input time, and `VariantService.deleteVariant` at deletion time — creation alone doesn't cover a variant being deleted down to zero later | `ProductMustHaveAtLeastOneVariantError` |
| Soft delete, never hard delete | Every repository's `softDelete`/equivalent — no repository in this module exposes a hard-delete method at all | — |

## 5. Logging

Every service method that mutates state logs on success (`logger.info`) and every rejected business
rule logs on failure (`logger.warn`) before the error is thrown — both go through Sprint 1's
`logger`, untouched. A route handler built on `createApiHandler` (Sprint 1) will additionally log
the resulting HTTP-level outcome; this service-level logging captures the business *reason*, which
the generic request log doesn't know about.

## 6. Gaps Flagged, Not Silently Filled

- **Barcode format validation lives only in `VariantService`, not in Sprint 2.1's
  `variant.validation.ts` Zod schema** (its barcode field is just `z.string().max(60).optional()`).
  I added a matching `barcodeSchema` regex validator to the new `shared.schema.ts` in this sprint,
  but wiring it into the actual `createVariantSchema` would mean editing the Sprint 2.1 file, which
  is out of scope. Until that migration happens, format validation is enforced once, at the service
  layer — real protection, but a single point of enforcement rather than defense in depth.
- **`ProductService.restoreProduct` resets status to `DRAFT`**, not back to `ACTIVE` — a genuine
  judgment call (a restored product should probably be re-reviewed before going live), not
  something the spec specified either way. Flagging it as a decision, not an oversight.
- **Low-stock detection (`findLowStock`) filters in application code, not in the database query** —
  Prisma can't express a column-to-column comparison across a relation (`quantityOnHand <=
  lowStockConfig.threshold`) in a `where` clause without raw SQL. Fine at this data volume; a raw
  query is a drop-in replacement if it ever needs to scale, noted in the code comment where it lives.
- **Product search uses `contains`/ILIKE, not `tsvector`** — the API architecture named `tsvector`
  as the eventual keyword-search mechanism. This sprint's `search()` is a working, correct interim
  implementation behind the same method signature; swapping the query internals later doesn't
  change the interface.

## What Sprint 2.3 Inherits

- Every service constructible with zero arguments (`new ProductService()`) or fully injectable for
  tests (`new ProductService(fakeProductRepo, fakeCategoryRepo, ...)`), following the same
  constructor-injection pattern as Sprint 1's `AuthService`.
- A single import surface (`@/features/catalog`) for API routes to build against — routes should
  never import from `services/*.impl.ts` or `repositories/*.impl.ts` directly.
- DTOs and mapper functions ready to serialize directly in a route handler's response.
- Domain errors that already format correctly through Sprint 1's untouched `api-handler.ts` — no
  new error-handling code needed in Sprint 2.3, just `try { ... } catch` via `createApiHandler`
  exactly as Sprint 1 designed it.

## Self-Review

- Caught and fixed, mid-build, two dead re-exports (`export type { Prisma }` in the inventory
  repository, `export type { ProductVariant }` in the variant service) — both were band-aids for an
  unused-import lint error rather than fixing the actual cause. Removed the unused imports instead.
- Caught and fixed a real unsafe pattern: the first draft of the Category/Brand services used
  `as PrismaCategoryRepository` casts to reach extension methods. Replaced with the
  extended-interface pattern described in §2 before this was packaged — a cast would have compiled
  against a test fake that didn't implement those methods and failed only at runtime.
- Caught a real business-rule gap while writing `product.service.impl.ts`: I'd imported
  `ProductMustHaveAtLeastOneVariantError` there out of habit without ever throwing it, since
  product *creation* already can't produce zero variants (Zod's `min(1)`). The actual gap was
  variant *deletion* — nothing stopped deleting a product down to zero variants after the fact.
  Moved the check to `VariantService.deleteVariant`, where the risk actually lives.
- Considered giving `ProductService` a dependency on `CategoryService`/`BrandService` instead of
  their repositories directly, for symmetry. Used the repositories instead — `ProductService` only
  needs a existence check (`findById`), not any category/brand business logic, so depending on the
  smaller surface (repository interface) rather than a whole sibling service was the better call.
