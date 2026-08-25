import { db } from '@/shared/lib/db';
import type { Category, SubCategory } from '@prisma/client';
import type { ICategoryRepository, ISubCategoryRepository } from '@/features/catalog/repositories/category.repository';
import type { CategoryWithSubCategories } from '@/features/catalog/types';

/**
 * Why this file exists: the concrete, Prisma-backed implementation of the
 * Sprint 2.1 repository interfaces. New file rather than editing
 * category.repository.ts directly — Sprint 2.1 is explicitly not to be
 * modified, and keeping the interface and implementation in separate
 * files also means a future alternate implementation (e.g. a cached
 * read-through repository) could implement the same interface without
 * touching this one.
 *
 * Deliberately does NOT extend Sprint 1's `BaseRepository`: that base
 * class's generic methods take Prisma's own `WhereUniqueInput` shapes,
 * but `ICategoryRepository` (Sprint 2.1) specifies plain-string-id method
 * signatures (`findById(id: string)`) and several composed queries
 * (`findAllWithSubCategories`) that the generic base has no way to
 * express. Rather than force an awkward, partially-overridden inheritance,
 * this class implements the interface directly against `db` — the same
 * single Prisma client every repository in the app uses, just without the
 * generic base's involvement. `BaseRepository` remains the right tool for
 * simple entities (see UserRepository); it isn't for this one.
 *
 * Responsibility: ONLY database access — no business rules. Slug-collision
 * checks and "has products/subcategories" checks are exposed as extra
 * query methods (`existsBySlug`, `countProducts`, `countSubCategories`)
 * that RETURN data; the decision about what to DO with that data (reject
 * the request, throw a specific error) belongs to CategoryService, never
 * here.
 *
 * Dependencies: db.ts (Sprint 1), category.repository.ts (interfaces),
 * catalog/types.ts.
 * Future usage: constructed by category.service.impl.ts.
 */
/**
 * Extended interfaces — Sprint 2.1's ICategoryRepository/ISubCategoryRepository
 * plus the extra query methods this sprint's services need for business-rule
 * checks (duplicate slug, has-products/has-subcategories). Additive: extends
 * rather than edits the Sprint 2.1 interfaces, and lets services depend on a
 * typed contract instead of casting to the concrete class.
 */
export interface ICategoryRepositoryExtended extends ICategoryRepository {
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  countProducts(categoryId: string): Promise<number>;
  countSubCategories(categoryId: string): Promise<number>;
}

export interface ISubCategoryRepositoryExtended extends ISubCategoryRepository {
  existsBySlugInCategory(categoryId: string, slug: string, excludeId?: string): Promise<boolean>;
  countProducts(subCategoryId: string): Promise<number>;
}

export class PrismaCategoryRepository implements ICategoryRepositoryExtended {
  async findById(id: string): Promise<Category | null> {
    return db.category.findFirst({ where: { id, deletedAt: null } });
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return db.category.findFirst({ where: { slug, deletedAt: null } });
  }

  async findAllWithSubCategories(): Promise<CategoryWithSubCategories[]> {
    return db.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        subCategories: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async create(input: Omit<Category, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    return db.category.create({ data: input });
  }

  async update(
    id: string,
    input: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Category> {
    return db.category.update({ where: { id }, data: input });
  }

  async softDelete(id: string): Promise<void> {
    await db.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Extra query beyond the Sprint 2.1 interface — backs CategoryService's duplicate-slug rule. */
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const count = await db.category.count({
      where: { slug, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return count > 0;
  }

  /** Extra — backs CategoryService's "prevent deleting categories with products" rule. */
  async countProducts(categoryId: string): Promise<number> {
    return db.product.count({ where: { categoryId, deletedAt: null } });
  }

  /** Extra — backs CategoryService's "prevent deleting categories with subcategories" rule. */
  async countSubCategories(categoryId: string): Promise<number> {
    return db.subCategory.count({ where: { categoryId, deletedAt: null } });
  }
}

export class PrismaSubCategoryRepository implements ISubCategoryRepositoryExtended {
  async findById(id: string): Promise<SubCategory | null> {
    return db.subCategory.findFirst({ where: { id, deletedAt: null } });
  }

  async findByCategoryId(categoryId: string): Promise<SubCategory[]> {
    return db.subCategory.findMany({
      where: { categoryId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(
    input: Omit<SubCategory, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>,
  ): Promise<SubCategory> {
    return db.subCategory.create({ data: input });
  }

  async update(
    id: string,
    input: Partial<Omit<SubCategory, 'id' | 'categoryId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<SubCategory> {
    return db.subCategory.update({ where: { id }, data: input });
  }

  async softDelete(id: string): Promise<void> {
    await db.subCategory.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Extra — backs SubCategoryService's duplicate-slug-within-category rule. */
  async existsBySlugInCategory(categoryId: string, slug: string, excludeId?: string): Promise<boolean> {
    const count = await db.subCategory.count({
      where: { categoryId, slug, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return count > 0;
  }

  async countProducts(subCategoryId: string): Promise<number> {
    return db.product.count({ where: { subCategoryId, deletedAt: null } });
  }
}
