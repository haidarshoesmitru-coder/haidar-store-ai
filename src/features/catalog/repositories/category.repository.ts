import type { Category, SubCategory } from '@prisma/client';
import type { CategoryWithSubCategories } from '@/features/catalog/types';

/**
 * Why this file exists: the repository *contract* for Category and
 * SubCategory, following the Repository Pattern established in
 * repositories/base.repository.ts (Sprint 1). Deliberately an interface
 * only — Sprint 2.1's scope is the foundation (schema, contracts,
 * validation), not working CRUD; a concrete
 * `PrismaCategoryRepository implements ICategoryRepository` (extending
 * Sprint 1's `BaseRepository` for the generic operations) is Sprint 2.2's
 * job.
 *
 * Responsibility: name every data-access operation the Category service
 * will need, with precise input/output types — nothing about *how* those
 * operations are performed.
 *
 * Dependencies: @prisma/client (types only), catalog/types.ts.
 * Future usage: implemented by a concrete class in Sprint 2.2; depended on
 * (by interface, not concrete class) by ICategoryService below, so the
 * service stays testable against a fake implementation.
 */
export interface ICategoryRepository {
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  /** Active categories with their subcategories loaded, ordered by sortOrder — the storefront nav shape. */
  findAllWithSubCategories(): Promise<CategoryWithSubCategories[]>;
  create(input: Omit<Category, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>): Promise<Category>;
  update(id: string, input: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Category>;
  /** Soft delete — sets deletedAt, never a hard DELETE. */
  softDelete(id: string): Promise<void>;
}

export interface ISubCategoryRepository {
  findById(id: string): Promise<SubCategory | null>;
  findByCategoryId(categoryId: string): Promise<SubCategory[]>;
  create(input: Omit<SubCategory, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>): Promise<SubCategory>;
  update(id: string, input: Partial<Omit<SubCategory, 'id' | 'categoryId' | 'createdAt' | 'updatedAt'>>): Promise<SubCategory>;
  softDelete(id: string): Promise<void>;
}
