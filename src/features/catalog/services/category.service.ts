import type { Category, SubCategory } from '@prisma/client';
import type { CategoryWithSubCategories } from '@/features/catalog/types';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubCategoryInput,
  UpdateSubCategoryInput,
} from '@/features/catalog/validation/category.validation';

/**
 * Why this file exists: the service *contract*, following the pattern
 * from features/auth/services/auth.service.ts — framework-agnostic
 * business logic, expressed here as an interface so Sprint 2.2's concrete
 * `CategoryService implements ICategoryService` can be built against a
 * fixed contract, and so route handlers (once built) depend on this
 * interface rather than a concrete class.
 *
 * The difference from ICategoryRepository: this interface expresses
 * business operations (uniqueness checks, slug collisions, cascading
 * soft-delete rules), not raw data access. A repository method is "insert
 * this row"; a service method is "create a category, and reject it if the
 * slug is already taken."
 *
 * Dependencies: catalog/types.ts, category.validation.ts (input types).
 * Future usage: implemented in Sprint 2.2, depended on by future
 * Category API routes and, indirectly, by IProductService (products need
 * to validate their categoryId/subCategoryId against real categories).
 */
export interface ICategoryService {
  getById(id: string): Promise<Category | null>;
  /** For storefront nav — active categories only, subcategories included. */
  listForNavigation(): Promise<CategoryWithSubCategories[]>;
  /** Rejects if the slug is already taken by another category. */
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, input: UpdateCategoryInput): Promise<Category>;
  /** Rejects (ConflictError) if the category still has active products or subcategories. */
  archive(id: string): Promise<void>;
}

export interface ISubCategoryService {
  getById(id: string): Promise<SubCategory | null>;
  listByCategory(categoryId: string): Promise<SubCategory[]>;
  /** Rejects if `categoryId` doesn't reference an existing, active Category. */
  create(input: CreateSubCategoryInput): Promise<SubCategory>;
  update(id: string, input: UpdateSubCategoryInput): Promise<SubCategory>;
  archive(id: string): Promise<void>;
}
