# Sprint 2.3 — Production API Layer (Catalog Module)

Sprints 1, 2.1, and 2.2 verified untouched before packaging (grepped for unexpected classes in
interface-only files; confirmed no edits to `schema.prisma`, `api-handler.ts`, `rbac.ts`, or any
`dto/*.ts`/`*.impl.ts` file from those sprints). Everything below is new: 14 route files, plus a
small catalog-specific API support layer (`src/features/catalog/api/`).

---

## 1. The Response-Envelope Conflict, Resolved Explicitly

This sprint specifies a response shape — `{ success, message, data, meta }` / `{ success, error,
code, details }` — that is **not** the shape Sprint 1's `shared/lib/api-handler.ts` and
`api-response.ts` already produce (`{ data }` / `{ error: { code, message, details, requestId } }`,
built in the earlier API-architecture planning phase). Editing those Sprint 1 files was out of
scope. Rather than silently pick one or the other, this sprint's API layer got its **own**
formatter and route wrapper:

- `src/features/catalog/api/response.ts` — the `{ success, message, data, meta }` /
  `{ success, error, code, details }` shapes, built fresh for this module.
- `src/features/catalog/api/handler.ts` — `createCatalogRoute`, structurally identical to Sprint
  1's `createApiHandler` (same auth resolution, same RBAC check, same try/catch, same requestId/
  logging), reusing every one of those Sprint 1 primitives unchanged — it just serializes through
  the new envelope instead of the old one.

Every route in this sprint uses `createCatalogRoute`, never Sprint 1's `createApiHandler`. If a
future module (Orders, AI Assistant) is told to use Sprint 1's original envelope, both wrappers
can coexist indefinitely — they share the same underlying primitives, just different output shapes.

## 2. A Real Security Issue Caught Before Any Route Shipped

Sprint 2.1/2.2's `ProductWithRelations`/`VariantSummary` types are typed to omit `costPrice`, but
the actual repository query (`product.repository.impl.ts`, Sprint 2.2) uses Prisma's `include`,
which fetches every scalar column regardless of what the TypeScript type claims — the omission is
a **compile-time-only** fiction; the real JavaScript object returned by Prisma still carries
`costPrice` on it at runtime.

This mattered nowhere before this sprint, because nothing had serialized that data into an HTTP
response yet. It would have mattered the moment a route handler did `return { data: product }`
with the raw service result. Caught during review, before any route was finalized:

- **Every** route in this module maps its result through Sprint 2.2's DTO functions
  (`toCategoryDto`, `toProductDto`, `toVariantDto`, ...) before returning it — never the raw
  service/repository result. The DTO functions build fresh object literals naming only the
  intended fields, so they're safe regardless of what extra runtime properties the input carries.
- I caught myself violating this in my own first drafts of the category and brand list routes
  (returning raw `Category[]`/`Brand[]` — no `costPrice` risk there, but still leaking the internal
  `deletedAt` field) and fixed them before packaging, not after.
- Product/variant cost visibility is handled at exactly one seam:
  `GET /api/v1/products/:id/variants/:variantId` branches on the caller's role
  (`hasRoleLevel(user, ROLE_LEVEL.manager)`) and calls either `getById`/`toVariantDto` (safe) or
  `getByIdForStaff`/`toVariantWithCostDto` (cost-inclusive). Every other product/variant-returning
  endpoint — including the product detail page and the variant list — always returns the safe DTO,
  full stop, regardless of caller role. One deliberate seam for privileged data, not a scattered
  set of role checks across every endpoint.

## 3. Endpoint Map

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/categories` | public | active categories + subcategories, DTO-mapped |
| POST | `/api/v1/categories` | manager+ | |
| GET | `/api/v1/categories/:id` | public | |
| PATCH | `/api/v1/categories/:id` | manager+ | |
| DELETE | `/api/v1/categories/:id` | admin | soft delete, rejects if has products/subcategories |
| GET | `/api/v1/brands` | public | |
| POST | `/api/v1/brands` | manager+ | |
| GET | `/api/v1/brands/:id` | public | |
| PATCH | `/api/v1/brands/:id` | manager+ | |
| DELETE | `/api/v1/brands/:id` | admin | rejects if brand in use |
| GET | `/api/v1/products` | public | keyword search, filters, price range, sort, cursor pagination |
| POST | `/api/v1/products` | manager+ | creates product + variant(s) + inventory in one call |
| GET | `/api/v1/products/:id` | public | always cost-safe |
| PATCH | `/api/v1/products/:id` | manager+ | |
| DELETE | `/api/v1/products/:id` | admin | archive (soft delete + status ARCHIVED) |
| GET | `/api/v1/products/:id/variants` | public | always cost-safe |
| POST | `/api/v1/products/:id/variants` | manager+ | duplicate SKU/barcode checked |
| GET | `/api/v1/products/:id/variants/:variantId` | public, role-branches | cost included for manager+ |
| PATCH | `/api/v1/products/:id/variants/:variantId` | manager+ | |
| DELETE | `/api/v1/products/:id/variants/:variantId` | admin | rejects if it's the product's last variant |
| POST | `/api/v1/inventory/stock-in` | staff+ | |
| POST | `/api/v1/inventory/stock-out` | staff+ | rejects if it would go negative |
| POST | `/api/v1/inventory/adjust` | staff+ | note required |
| GET | `/api/v1/inventory/:variantId` | staff+ | current stock + threshold |
| GET | `/api/v1/inventory/:variantId/history` | staff+ | paginated transaction ledger |
| GET | `/api/v1/inventory/low-stock` | staff+ | |

RBAC levels applied exactly per the table finalized in the earlier API-architecture planning phase
(staff < manager < admin, each including the levels below) — this sprint didn't invent a new
policy, just wired the existing one (`ROLE_LEVEL` from Sprint 1's `server/auth/rbac.ts`) into every
route.

## 4. Search, Filtering, Sorting — and Why It's a New Repository, Not a Modified One

Sprint 2.2's `PrismaProductRepository.search()` has no sort support and always fetches the full
product-detail relation graph (every variant, every attribute, every image). This sprint needs
sorting (price asc/desc, newest, best-selling) — but Sprint 2.2 can't be edited. Rather than bolt
sorting onto an unmodifiable method from outside, `product-search.repository.impl.ts` is a
genuinely separate, more appropriately-scoped query: a list/search endpoint needs a **lighter**
projection (primary image + starting price, not the full detail graph) than a product detail page —
which is this sprint's own "only return required fields" requirement, independent of the
modification constraint. `ProductSearchService` is a thin pass-through wrapper around it, existing
solely so the route never calls a repository directly (this sprint's explicit "do not bypass
Services" rule) — flagged as a file that exists for architectural consistency, not because the
repository needed business logic added.

Price sorting uses Prisma's relation-aggregate `orderBy` (`orderBy: { variants: { _min: { price:
'asc' } } }`) rather than fetching all variants and sorting in application code.

**Flagged tradeoff:** the product `include`/projection shape now exists in two places (Sprint 2.2's
full-detail one, this sprint's lighter one). A future cleanup pass could have Sprint 2.2 export a
shared base projection both build on — not done here specifically to avoid touching a previous
sprint's file.

## 5. Validation

Every route validates: body (via `validate()`, Sprint 1, throwing `ValidationError` with every
failing field at once), query string (`parseSearchParams`, this sprint — raw
`URLSearchParams` entries parsed and coerced through Zod, since query strings are always raw
strings regardless of the target field's real type), and route params (`parseUuidParam` — every
`:id` is validated as a UUID before it ever reaches a service).

Two new Zod schema files were needed because Sprint 2.2's `ProductSearchDto`/`StockInDto`/
`StockOutDto`/`AdjustInventoryDto` were plain TypeScript interfaces (correct for Sprint 2.2's scope
— service/repository layer, not HTTP parsing) with no Zod backing:
- `route-query.schema.ts` — query-string schemas, including the `"true"`/`"false"` string ->
  boolean and numeric-string -> number coercion HTTP query params always need.
- `inventory-request.schema.ts` — the three inventory mutation request bodies.

## 6. Performance

- Every list/search endpoint is cursor-paginated (never offset) — `meta.pagination.{nextCursor,
  hasMore}` on every paginated response.
- The product list/search endpoint fetches a lighter projection than product detail (§4) —
  avoiding over-fetching full variant/attribute graphs for a page of 24 list-view cards.
- No N+1s: every list query uses Prisma's `include`/relation-aggregate features in a single query;
  nothing in this sprint loops over results issuing per-row queries.

## 7. WhatsApp / Multi-Channel Compatibility — What's True and What Isn't Yet

**True today:** the JSON contract itself is channel-agnostic. Any client — the website, a future
WhatsApp AI backend, a future mobile app — hits the same `/api/v1/*` routes and gets the same
envelope shape back. Nothing in the route or service layer assumes a browser.

**Not solved by this sprint, flagged rather than glossed over:** every write operation's
authorization currently runs through `getCurrentUser()` (Sprint 1), which reads a NextAuth
**database session cookie**. A server-to-server WhatsApp integration has no browser session and no
cookie — it would need a different authentication mechanism (a service API key, or a scoped JWT
issued to trusted backend clients) to call `manager`/`admin`/`staff`-gated endpoints on a
customer's behalf. This sprint's task list said "prepare middleware for future WhatsApp API
usage," and the honest state is: the *route/response contract* is ready; the *auth mechanism* for
a non-browser trusted client is a real gap for whichever sprint builds the WhatsApp integration —
not something to claim is solved here.

## Self-Review

- Caught mid-build: my own stated barrel-import rule ("nothing outside this module should reach
  into internal paths directly") was violated in my first drafts of the variant and inventory
  routes, which imported DTO functions and Sprint 2.1 schemas directly instead of through
  `@/features/catalog`. Fixed every occurrence before packaging — grepped to confirm zero remaining
  direct imports across all 14 route files.
- Caught the `costPrice` runtime-leak risk described in §2 while writing the product detail route,
  before it became a shipped bug rather than after.
- Considered adding a generic `role`-based response-shaping helper (e.g., a `withCostVisibility()`
  wrapper) rather than the explicit branch in the single variant-detail route. Kept the explicit
  branch — one clearly-named `if (hasRoleLevel(...))` in the one place cost data can appear is more
  auditable than a generic mechanism that could accidentally get reused somewhere cost shouldn't
  leak.
- Did not add rate limiting in this sprint — the API-architecture planning phase named it (§22) as
  Redis-backed middleware, which doesn't exist in this codebase yet (no Redis client was set up in
  any prior sprint). Flagging as a real gap rather than faking it with an in-memory limiter that
  wouldn't survive a serverless cold start.
