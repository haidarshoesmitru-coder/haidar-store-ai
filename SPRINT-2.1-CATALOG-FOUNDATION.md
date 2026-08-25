# Sprint 2.1 — Catalog & Product Management Foundation

Scope delivered: Prisma schema, folder structure, entity relationships, repository interfaces,
service interfaces, Zod validation schemas. No repository implementations, no API routes, no UI —
exactly as scoped. Sprint 1 (`Role`, `User`, and everything under `src/shared/`, `src/server/`,
`src/app/`) is untouched.

---

## 1. Entity Relationships

```
Category (1) ──< (many) SubCategory
Category (1) ──< (many) Product
SubCategory (1) ──< (many) Product                [optional — Product.subCategoryId is nullable]
Brand (1) ──< (many) Product                       [optional — Product.brandId is nullable]

Product (1) ──< (many) ProductImage
Product (1) ──< (many) ProductVariant

ProductVariant (1) ──< (many) ProductImage         [optional — an image can be variant-specific]
ProductVariant (1) ──< (many) VariantAttribute >── (many-to-one) Attribute
ProductVariant (1) ──── (1) Inventory
ProductVariant (1) ──── (1) LowStockConfiguration

Inventory (1) ──< (many) InventoryTransaction
InventoryTransaction (many) ──── (1, optional) User   [performedByUserId — who made a manual entry]

Attribute (1) ──< (many) VariantAttribute
```

Reading order matches the spec's stated chain: **Category → SubCategory → Product → Variant →
Inventory**, with `Brand`, `ProductImage`, and `Attribute` as the supporting entities that hang
off that spine.

### Why `Attribute` exists beyond the named 10 entities

The spec lists `VariantAttribute` and says "do not hardcode, use scalable modeling." Those two
requirements together need a definitions table: without one, `VariantAttribute` would have to
store an attribute *name* as a free-text column with no governance — nothing stopping "Size",
"size", and "SIZE" from becoming three different attributes by typo, and nothing giving a future
admin UI a dropdown of known attributes to pick from. `Attribute` is that one small table (`name`,
`code`, `dataType`); `VariantAttribute` is the assignment (`variantId` + `attributeId` + `value`).
This is the same shape as the `Attribute`/`VariantAttributeValue` pair from the earlier database
design phase, narrowed to what this sprint's named entity list actually needs — I did **not**
carry forward that phase's `AttributeOption` (predefined dropdown values) or `CategoryAttribute`
(which attributes apply to which category) tables, since neither was named in this sprint's scope
and both are additive later without a redesign (see §4).

### Why `Product` has no price/SKU/barcode/stock of its own

Every `Product` has at least one `ProductVariant` (flagged `isDefault: true` when there's no real
variation — a single lipstick is one variant, same as a shoe with 8 real size/color variants).
Price, SKU, barcode, and stock all live on `ProductVariant`. This means a "Shoes" product and a
"General Store" product go through the exact same shape — nothing category-specific is hardcoded
into `Product` or `ProductVariant` themselves; category-specific variation (Size for shoes, Shade
for makeup, Expiry for general store) is entirely data, living in `Attribute`/`VariantAttribute`.

### Why `Category` doesn't self-reference this time

The earlier database design phase used a self-referencing `Category` (arbitrary depth) with no
separate `SubCategory` table. This sprint's spec explicitly names `SubCategory` as its own entity
and draws the relationship chain as `Category → SubCategory → Product` — a fixed two-level depth.
I followed this sprint's explicit spec rather than the earlier general design, since it's the more
recent and more specific instruction for this exact module. Two-level depth comfortably covers all
four business categories (Shoes → Men's/Women's/Kids'; Jewellery → Rings/Necklaces/Earrings, etc.)
without needing arbitrary nesting.

---

## 2. Folder Structure

```
src/features/catalog/
├── types.ts                              Domain types (DTOs, composite read shapes)
├── validation/
│   ├── category.validation.ts            Category + SubCategory Zod schemas
│   ├── brand.validation.ts               Brand Zod schemas
│   ├── product.validation.ts             Product + ProductImage Zod schemas
│   ├── variant.validation.ts             ProductVariant + VariantAttribute Zod schemas
│   └── inventory.validation.ts           InventoryTransaction + LowStockConfiguration Zod schemas
├── repositories/
│   ├── category.repository.ts            ICategoryRepository, ISubCategoryRepository
│   ├── brand.repository.ts               IBrandRepository
│   ├── product.repository.ts             IProductRepository (+ ProductImage)
│   ├── product-variant.repository.ts     IProductVariantRepository (+ VariantAttribute)
│   └── inventory.repository.ts           IInventoryRepository (+ InventoryTransaction, LowStockConfiguration)
└── services/
    ├── category.service.ts               ICategoryService, ISubCategoryService
    ├── brand.service.ts                  IBrandService
    ├── product.service.ts                IProductService
    └── inventory.service.ts              IInventoryService
```

### Why five repository/service files instead of ten (one per named entity)

Grouping follows **aggregate boundaries**, not a 1:1 mapping to Prisma models — this is the same
judgment call Sprint 1 made keeping `ProductImage`/`VariantAttribute` out of their own files:

- `ProductImage` has no lifecycle independent of a `Product` (or `ProductVariant`) — it's always
  created, listed, and deleted in that context. It doesn't get its own repository/service.
- `VariantAttribute` has no lifecycle independent of a `ProductVariant` — same reasoning.
- `Inventory`, `InventoryTransaction`, and `LowStockConfiguration` are one aggregate: all three
  only make sense in relation to a variant's stock lifecycle, and — critically — grouping them
  behind one repository is what makes "there is exactly one write path for stock" enforceable at
  the interface level (see `IInventoryRepository`'s doc comment: no generic `update()` method
  exists on it, only `recordTransaction()`).

Ten files mirroring ten tables would look more "complete" but would actually make the one-write-
path-for-stock rule *harder* to enforce, not easier, since nothing would stop a future
`InventoryRepository` and a future `InventoryTransactionRepository` from independently exposing
ways to touch `quantityOnHand`.

### Why `Attribute` has no repository/service of its own

It's a small, rarely-changing reference table (the equivalent of a lookup/enum-as-data table).
Sprint 2.2 can add `IAttributeRepository` if a dedicated "manage attribute definitions" admin
screen is built — flagged here as a real gap, not silently decided: this sprint's scope explicitly
excludes CRUD and UI, so there was no forcing function to design that interface yet.

---

## 3. Design Decisions Worth Flagging (not silently made)

1. **`VariantAttribute.value` is plain text**, not a foreign key to a predefined options table. A
   `Size` attribute doesn't restrict input to `{S, M, L, XL}` at the database level in this
   foundation. This is a deliberate scope-narrowing choice (the earlier DB design's
   `AttributeOption` table isn't in this sprint's named entity list) — adding enforced/predefined
   values later is additive (a new `AttributeOption` table + a nullable FK on `VariantAttribute`),
   not a breaking change, but it means Sprint 2.2's validation layer is the only thing preventing
   "Blue" and "blue" from being treated as different variants until that's built.

2. **No `CategoryAttribute` governance table** — nothing in this schema currently says "Shoes
   products must have a Size attribute." Any `Attribute` can be assigned to any variant regardless
   of category. This was in the earlier DB design phase and was deliberately left out here since
   it wasn't named in this sprint's entity list; noting it as a real gap for Sprint 2.2 to decide
   on, not an oversight.

3. **Repository interfaces split `findById` vs `findByIdForStaff`** on `ProductVariant`
   specifically to make the cost-price/margin visibility rule (manager/admin only, per the API
   architecture) a contract-level guarantee rather than something every future call site has to
   remember to filter.

4. **`Product.status` and soft-delete (`deletedAt`) coexist deliberately.** `archive()` in the
   service interfaces sets both `status: ARCHIVED` and `deletedAt` — `status` drives what's
   visible/orderable in normal queries, `deletedAt` is the audit-friendly "this row is retired"
   marker default repository queries should filter out. Neither alone was suffilient: `status`
   alone doesn't give a clean way to permanently hide a category/brand that has no status field of
   its own; `deletedAt` alone doesn't capture the DRAFT/ACTIVE/ARCHIVED lifecycle a product goes
   through while still very much "alive."

## 4. What Sprint 2.2 Inherits

- Concrete `Prisma*Repository` classes implementing every interface here, extending Sprint 1's
  `BaseRepository` for the generic operations, following `UserRepository`'s exact pattern.
- Concrete `*Service` classes implementing every interface here, constructor-injected with their
  repository interfaces — same shape as `AuthService`.
- API routes built on Sprint 1's `createApiHandler`, calling these services — never Prisma
  directly, and never containing business logic themselves.
- The open items flagged in §3 (predefined attribute options, category-attribute governance,
  attribute-definition management) are real decisions for that sprint, not settled here.

## Self-Review

- Considered putting `VariantAttribute` on its own repository (`IVariantAttributeRepository`) to
  mirror the entity list exactly — rejected: it has no operation that isn't "part of creating or
  updating a variant," so a standalone repository would just be a thin pass-through nobody calls
  independently. Folded into `IProductVariantRepository` instead.
- Considered making `Inventory.quantityReserved` part of this sprint even though it wasn't named —
  kept it, since without it, "instant reserve stock on cart add" (a near-certain need once Orders
  exists) would require an unplanned schema migration, and the field costs nothing to have present
  and unused today. This is the one place I added a field beyond the literal ask; flagging it
  rather than burying it.
- Checked every new relation has its required back-reference field (Prisma's two-sided relation
  requirement) — the one that wasn't obvious was `User.inventoryTransactions`, added with a
  comment explaining it's mechanical, not a functional change to the Sprint 1 model.
- Confirmed soft-delete (`deletedAt`) is present on every entity with an independent lifecycle
  (`Category`, `SubCategory`, `Brand`, `Product`, `ProductVariant`) and deliberately absent from
  `InventoryTransaction` (append-only ledger — nothing to soft-delete) and `Inventory`/
  `LowStockConfiguration` (1:1 operational state tied to a variant's own lifecycle — they don't
  outlive the variant to need independent deletion semantics).
