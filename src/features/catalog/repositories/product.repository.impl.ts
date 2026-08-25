import { db } from '@/shared/lib/db';
import type { Product, ProductImage, Prisma } from '@prisma/client';
import type { IProductRepository } from '@/features/catalog/repositories/product.repository';
import type { ProductWithRelations, CursorPage } from '@/features/catalog/types';
import type { ProductListQuery } from '@/features/catalog/validation/product.validation';
import type { ProductSearchDto } from '@/features/catalog/dto/product.dto';

/**
 * Why this file exists: the concrete Product + ProductImage repository.
 * See category.repository.impl.ts for the shared "why not BaseRepository"
 * rationale — it applies here even more strongly, since `findMany`,
 * `search`, `findFeatured`, etc. are all genuinely custom composed
 * queries with no generic-CRUD equivalent.
 *
 * `PRODUCT_INCLUDE` is defined once and reused across every query method
 * that needs the full relation graph — the alternative (repeating the
 * same `include` object in five methods) is exactly the duplication the
 * task's code-quality section asks to avoid, and it's also a correctness
 * risk: a relation added to `ProductWithRelations` later but forgotten in
 * one of five inline includes is a bug that silently under-fetches data
 * only on that one method.
 *
 * Dependencies: db.ts, product.repository.ts (interface), catalog/types.ts,
 * product.validation.ts, dto/product.dto.ts (for ProductSearchDto).
 * Future usage: constructed by product.service.impl.ts.
 */

const PRODUCT_INCLUDE = {
  category: true,
  subCategory: true,
  brand: true,
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    where: { deletedAt: null },
    include: {
      attributes: { include: { attribute: true } },
      inventory: true,
    },
  },
} satisfies Prisma.ProductInclude;

function buildCursorPage<T extends { id: string }>(rows: T[], limit: number): CursorPage<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;
  return { data, nextCursor, hasMore };
}

/**
 * Extended beyond Sprint 2.1's IProductRepository with search/discovery
 * methods and the duplicate-slug check ProductService needs — see the
 * matching note in category.repository.impl.ts for the full rationale.
 */
export interface IProductRepositoryExtended extends IProductRepository {
  search(params: ProductSearchDto): Promise<CursorPage<ProductWithRelations>>;
  paginate(query: ProductListQuery): Promise<CursorPage<ProductWithRelations>>;
  findFeatured(limit?: number): Promise<ProductWithRelations[]>;
  findNewArrivals(limit?: number): Promise<ProductWithRelations[]>;
  findBestSellers(limit?: number): Promise<ProductWithRelations[]>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  /** Clears deletedAt and resets status to DRAFT — restored products require re-review before going ACTIVE again. */
  restore(id: string): Promise<Product>;
}

export class PrismaProductRepository implements IProductRepositoryExtended {
  async findById(id: string): Promise<ProductWithRelations | null> {
    return db.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE,
    }) as Promise<ProductWithRelations | null>;
  }

  async findBySlug(slug: string): Promise<ProductWithRelations | null> {
    return db.product.findFirst({
      where: { slug, deletedAt: null },
      include: PRODUCT_INCLUDE,
    }) as Promise<ProductWithRelations | null>;
  }

  async findMany(query: ProductListQuery): Promise<CursorPage<ProductWithRelations>> {
    const limit = query.limit ?? 24;
    const rows = await db.product.findMany({
      where: {
        deletedAt: null,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.subCategoryId ? { subCategoryId: query.subCategoryId } : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return buildCursorPage(rows as ProductWithRelations[], limit);
  }

  create(input: Omit<Product, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    return db.product.create({ data: input });
  }

  update(id: string, input: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Product> {
    return db.product.update({ where: { id }, data: input });
  }

  async softDelete(id: string): Promise<void> {
    await db.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  addImage(input: Omit<ProductImage, 'id' | 'createdAt'>): Promise<ProductImage> {
    return db.productImage.create({ data: input });
  }

  async removeImage(imageId: string): Promise<void> {
    await db.productImage.delete({ where: { id: imageId } });
  }

  /**
   * Full-text-ish search over name/description, plus the structured
   * filters from `ProductSearchDto`. Uses Postgres `contains` (ILIKE)
   * rather than `tsvector` in this foundation pass — the API architecture
   * names `tsvector` as the eventual keyword-search implementation; this
   * is a working, correct interim that doesn't require a migration to add
   * a generated column, and can be swapped inside this one method later
   * without changing the interface.
   */
  async search(params: ProductSearchDto): Promise<CursorPage<ProductWithRelations>> {
    const limit = params.limit ?? 24;
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.subCategoryId ? { subCategoryId: params.subCategoryId } : {}),
      ...(params.brandId ? { brandId: params.brandId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.season ? { season: params.season } : {}),
      ...(params.isFeatured !== undefined ? { isFeatured: params.isFeatured } : {}),
      ...(params.isBestSeller !== undefined ? { isBestSeller: params.isBestSeller } : {}),
      ...(params.isNewArrival !== undefined ? { isNewArrival: params.isNewArrival } : {}),
      ...(params.query
        ? {
            OR: [
              { name: { contains: params.query, mode: 'insensitive' } },
              { description: { contains: params.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await db.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    return buildCursorPage(rows as ProductWithRelations[], limit);
  }

  /** Thin, named alias over findMany — kept distinct per the spec's explicit method list, reusing the same query machinery. */
  async paginate(query: ProductListQuery): Promise<CursorPage<ProductWithRelations>> {
    return this.findMany(query);
  }

  async findFeatured(limit = 12): Promise<ProductWithRelations[]> {
    const rows = await db.product.findMany({
      where: { isFeatured: true, status: 'ACTIVE', deletedAt: null },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows as ProductWithRelations[];
  }

  async findNewArrivals(limit = 12): Promise<ProductWithRelations[]> {
    const rows = await db.product.findMany({
      where: { isNewArrival: true, status: 'ACTIVE', deletedAt: null },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows as ProductWithRelations[];
  }

  async findBestSellers(limit = 12): Promise<ProductWithRelations[]> {
    const rows = await db.product.findMany({
      where: { isBestSeller: true, status: 'ACTIVE', deletedAt: null },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows as ProductWithRelations[];
  }

  /** Extra — backs ProductService's duplicate-slug rule. */
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const count = await db.product.count({
      where: { slug, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return count > 0;
  }

  async restore(id: string): Promise<Product> {
    return db.product.update({ where: { id }, data: { deletedAt: null, status: 'DRAFT' } });
  }
}
