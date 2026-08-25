import { db } from '@/shared/lib/db';
import type { Prisma } from '@prisma/client';
import type { CursorPage } from '@/features/catalog/types';
import type { ProductSearchQuery } from '@/features/catalog/validation/route-query.schema';

/**
 * Why this file exists: this sprint's spec asks for sortable product
 * search (price asc/desc, newest, best-selling) — a capability Sprint
 * 2.2's `PrismaProductRepository.search()` doesn't have (it always sorts
 * `createdAt desc`), and Sprint 2.2 is not to be modified. Rather than
 * bolt sorting onto that method from outside, this is a genuinely
 * separate, appropriately-scoped query: a list/search endpoint needs a
 * LIGHTER projection than a product detail page (just the primary image
 * and starting price, not the full variant/attribute graph Sprint 2.2's
 * `PRODUCT_INCLUDE` hydrates) — which is exactly this sprint's own
 * "only return required fields" performance requirement. So this isn't
 * only a workaround for the "don't modify Sprint 2.2" constraint; it's
 * independently the right shape for a search/list endpoint.
 *
 * Flagged tradeoff: this does mean the product `include` shape is defined
 * in two places (Sprint 2.2's full-detail one, and this lighter one) — a
 * future cleanup pass could have Sprint 2.2 export a shared base include
 * both build on. Not done here to avoid touching a previous sprint's file.
 *
 * Price sorting: Prisma's `orderBy` only supports `_count` on a to-many
 * relation, not `_min`/`_max` — there is no way to ask Postgres directly
 * for "products ordered by their cheapest variant's price" through a
 * single Prisma call. `search()` handles `price_asc`/`price_desc` as a
 * genuinely separate two-step query below: sort at the ProductVariant
 * level (where `isDefault: true`, applying the same Product filters via
 * a nested `product` clause), then fetch the matching Products and
 * re-order them to match. This keeps a single scannable/indexable ORDER
 * BY (on ProductVariant.price) rather than a per-row computed aggregate.
 *
 * Dependencies: db.ts (Sprint 1), catalog/types.ts (Sprint 2.1),
 * route-query.schema.ts (this sprint).
 * Future usage: GET /api/v1/products (list/search/filter/sort/paginate).
 */

const LIST_INCLUDE = {
  images: { where: { isPrimary: true }, take: 1 },
  variants: {
    where: { deletedAt: null, isDefault: true },
    take: 1,
    select: { id: true, price: true },
  },
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductInclude;

type ProductListRow = Prisma.ProductGetPayload<{ include: typeof LIST_INCLUDE }>;

export interface ProductListRowDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  categoryName: string;
  brandName: string | null;
  primaryImageUrl: string | null;
  startingPrice: string | null;
}

function toListRowDto(row: ProductListRow): ProductListRowDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    isFeatured: row.isFeatured,
    isBestSeller: row.isBestSeller,
    isNewArrival: row.isNewArrival,
    categoryName: row.category.name,
    brandName: row.brand?.name ?? null,
    primaryImageUrl: row.images[0]?.url ?? null,
    startingPrice: row.variants[0]?.price.toString() ?? null,
  };
}

function buildOrderBy(
  sort: Exclude<ProductSearchQuery['sort'], 'price_asc' | 'price_desc'>,
): Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'best_selling':
      return [{ isBestSeller: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

export class ProductSearchRepository {
  async search(query: ProductSearchQuery): Promise<CursorPage<ProductListRowDto>> {
    const limit = query.limit ?? 24;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: query.status ?? 'ACTIVE',
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.subCategoryId ? { subCategoryId: query.subCategoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.season ? { season: query.season } : {}),
      ...(query.isFeatured !== undefined ? { isFeatured: query.isFeatured } : {}),
      ...(query.isBestSeller !== undefined ? { isBestSeller: query.isBestSeller } : {}),
      ...(query.isNewArrival !== undefined ? { isNewArrival: query.isNewArrival } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            variants: {
              some: {
                deletedAt: null,
                price: {
                  ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
                  ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
                },
              },
            },
          }
        : {}),
    };

    if (query.sort === 'price_asc' || query.sort === 'price_desc') {
      return this.searchSortedByPrice(where, query.sort, limit, query.cursor);
    }

    const rows = (await db.product.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: buildOrderBy(query.sort),
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    })) as ProductListRow[];

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: page.map(toListRowDto),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  /**
   * Price sorting's separate path (see file header comment): sorts at the
   * default-variant level, then re-fetches full product rows and puts
   * them back in that price order — `db.product.findMany({ where: { id:
   * { in: [...] } } })` does not itself preserve array order, so the
   * re-sort by productIds order at the end is required, not optional.
   *
   * Pagination here uses a numeric offset encoded as the cursor string,
   * NOT Prisma's id-based `cursor`/`skip: 1` — `ProductVariant.productId`
   * isn't a unique field (a product can have many variants), so it can't
   * be a Prisma cursor key even filtered to `isDefault: true`. Offset
   * pagination is the correct, schema-respecting choice for this one sort
   * mode; every other sort mode still uses id-based cursors above.
   */
  private async searchSortedByPrice(
    where: Prisma.ProductWhereInput,
    sort: 'price_asc' | 'price_desc',
    limit: number,
    cursor?: string,
  ): Promise<CursorPage<ProductListRowDto>> {
    const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;

    const variantRows = await db.productVariant.findMany({
      where: { deletedAt: null, isDefault: true, product: where },
      select: { productId: true },
      orderBy: [{ price: sort === 'price_asc' ? 'asc' : 'desc' }, { productId: 'asc' }],
      take: limit + 1,
      skip: offset,
    });

    const hasMore = variantRows.length > limit;
    const page = hasMore ? variantRows.slice(0, limit) : variantRows;
    const productIds = page.map((v) => v.productId);

    if (productIds.length === 0) {
      return { data: [], nextCursor: null, hasMore: false };
    }

    const productRows = await db.product.findMany({
      where: { id: { in: productIds } },
      include: LIST_INCLUDE,
    });
    const byId = new Map(productRows.map((p) => [p.id, p]));
    const ordered = productIds.map((id) => byId.get(id)).filter((p): p is ProductListRow => p !== undefined);

    return {
      data: ordered.map(toListRowDto),
      nextCursor: hasMore ? String(offset + limit) : null,
      hasMore,
    };
  }
}
