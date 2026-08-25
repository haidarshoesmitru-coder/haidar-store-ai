import type { Category, SubCategory } from '@prisma/client';
import type { ICategoryService, ISubCategoryService } from '@/features/catalog/services/category.service';
import {
  PrismaCategoryRepository,
  PrismaSubCategoryRepository,
  type ICategoryRepositoryExtended,
  type ISubCategoryRepositoryExtended,
} from '@/features/catalog/repositories/category.repository.impl';
import type { CategoryWithSubCategories } from '@/features/catalog/types';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubCategoryInput,
  UpdateSubCategoryInput,
} from '@/features/catalog/validation/category.validation';
import {
  CategoryNotFoundError,
  SubCategoryNotFoundError,
  CategoryAlreadyExistsError,
  CategoryHasProductsError,
  CategoryHasSubCategoriesError,
} from '@/features/catalog/errors';
import { logger } from '@/shared/lib/logger';
import { stripUndefined } from '@/shared/utils/strip-undefined';

/**
 * Why this file exists: the concrete business-logic layer for
 * Category/SubCategory — implements the Sprint 2.1 `ICategoryService`/
 * `ISubCategoryService` interfaces (so anything depending on those
 * interfaces works unchanged) while exposing this sprint's requested
 * method names (`createCategory`/`updateCategory`/`deleteCategory`) as
 * the primary public API. The interface-required names are thin aliases
 * over the named ones, not a second implementation — see the bottom of
 * each class.
 *
 * ALL business rules live here, never in the repository (which only
 * knows how to read/write rows) and never in a future route handler
 * (which will only call these methods).
 *
 * Dependencies: category.repository.ts (interfaces), category.repository.impl.ts
 * (concrete repos, default-constructed — see AuthService in Sprint 1 for
 * the same constructor-injection pattern), catalog/errors.ts, logger.ts.
 * Future usage: constructed by Sprint 2.3's Category API routes; consumed
 * by ProductService to validate categoryId/subCategoryId references.
 */
export class CategoryService implements ICategoryService {
  constructor(private readonly categoryRepository: ICategoryRepositoryExtended = new PrismaCategoryRepository()) {}

  async getById(id: string): Promise<Category | null> {
    return this.categoryRepository.findById(id);
  }

  async listForNavigation(): Promise<CategoryWithSubCategories[]> {
    return this.categoryRepository.findAllWithSubCategories();
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const repo = this.categoryRepository;
    const slugTaken = await repo.existsBySlug(input.slug);
    if (slugTaken) {
      logger.warn('Category creation rejected: duplicate slug', { slug: input.slug });
      throw new CategoryAlreadyExistsError(input.slug);
    }

    const category = await this.categoryRepository.create({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      sortOrder: input.sortOrder,
      isActive: true,
    });

    logger.info('Category created', { categoryId: category.id, slug: category.slug });
    return category;
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) throw new CategoryNotFoundError(id);

    if (input.slug && input.slug !== existing.slug) {
      const repo = this.categoryRepository;
      const slugTaken = await repo.existsBySlug(input.slug, id);
      if (slugTaken) {
        logger.warn('Category update rejected: duplicate slug', { categoryId: id, slug: input.slug });
        throw new CategoryAlreadyExistsError(input.slug);
      }
    }

    const category = await this.categoryRepository.update(id, stripUndefined(input));
    logger.info('Category updated', { categoryId: id });
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) throw new CategoryNotFoundError(id);

    const repo = this.categoryRepository;
    const [productCount, subCategoryCount] = await Promise.all([
      repo.countProducts(id),
      repo.countSubCategories(id),
    ]);

    if (productCount > 0) {
      logger.warn('Category deletion rejected: has products', { categoryId: id, productCount });
      throw new CategoryHasProductsError(id, productCount);
    }
    if (subCategoryCount > 0) {
      logger.warn('Category deletion rejected: has subcategories', { categoryId: id, subCategoryCount });
      throw new CategoryHasSubCategoriesError(id, subCategoryCount);
    }

    await this.categoryRepository.softDelete(id);
    logger.info('Category deleted (soft)', { categoryId: id });
  }

  // --- ICategoryService (Sprint 2.1 contract) — thin aliases over the methods above ---
  create(input: CreateCategoryInput): Promise<Category> {
    return this.createCategory(input);
  }
  update(id: string, input: UpdateCategoryInput): Promise<Category> {
    return this.updateCategory(id, input);
  }
  archive(id: string): Promise<void> {
    return this.deleteCategory(id);
  }
}

export class SubCategoryService implements ISubCategoryService {
  constructor(
    private readonly subCategoryRepository: ISubCategoryRepositoryExtended = new PrismaSubCategoryRepository(),
    private readonly categoryRepository: ICategoryRepositoryExtended = new PrismaCategoryRepository(),
  ) {}

  async getById(id: string): Promise<SubCategory | null> {
    return this.subCategoryRepository.findById(id);
  }

  async listByCategory(categoryId: string): Promise<SubCategory[]> {
    return this.subCategoryRepository.findByCategoryId(categoryId);
  }

  async createSubCategory(input: CreateSubCategoryInput): Promise<SubCategory> {
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) throw new CategoryNotFoundError(input.categoryId);

    const repo = this.subCategoryRepository;
    const slugTaken = await repo.existsBySlugInCategory(input.categoryId, input.slug);
    if (slugTaken) {
      logger.warn('SubCategory creation rejected: duplicate slug in category', {
        categoryId: input.categoryId,
        slug: input.slug,
      });
      throw new CategoryAlreadyExistsError(input.slug);
    }

    const subCategory = await this.subCategoryRepository.create({
      categoryId: input.categoryId,
      name: input.name,
      slug: input.slug,
      sortOrder: input.sortOrder,
      isActive: true,
    });

    logger.info('SubCategory created', { subCategoryId: subCategory.id, categoryId: input.categoryId });
    return subCategory;
  }

  async updateSubCategory(id: string, input: UpdateSubCategoryInput): Promise<SubCategory> {
    const existing = await this.subCategoryRepository.findById(id);
    if (!existing) throw new SubCategoryNotFoundError(id);

    if (input.slug && input.slug !== existing.slug) {
      const repo = this.subCategoryRepository;
      const slugTaken = await repo.existsBySlugInCategory(existing.categoryId, input.slug, id);
      if (slugTaken) throw new CategoryAlreadyExistsError(input.slug);
    }

    const subCategory = await this.subCategoryRepository.update(id, stripUndefined(input));
    logger.info('SubCategory updated', { subCategoryId: id });
    return subCategory;
  }

  async deleteSubCategory(id: string): Promise<void> {
    const existing = await this.subCategoryRepository.findById(id);
    if (!existing) throw new SubCategoryNotFoundError(id);

    const repo = this.subCategoryRepository;
    const productCount = await repo.countProducts(id);
    if (productCount > 0) {
      logger.warn('SubCategory deletion rejected: has products', { subCategoryId: id, productCount });
      throw new CategoryHasProductsError(id, productCount);
    }

    await this.subCategoryRepository.softDelete(id);
    logger.info('SubCategory deleted (soft)', { subCategoryId: id });
  }

  // --- ISubCategoryService (Sprint 2.1 contract) — thin aliases ---
  create(input: CreateSubCategoryInput): Promise<SubCategory> {
    return this.createSubCategory(input);
  }
  update(id: string, input: UpdateSubCategoryInput): Promise<SubCategory> {
    return this.updateSubCategory(id, input);
  }
  archive(id: string): Promise<void> {
    return this.deleteSubCategory(id);
  }
}
