import type { Category, SubCategory } from '@prisma/client';
import type { CreateCategoryInput, UpdateCategoryInput } from '@/features/catalog/validation/category.validation';

/**
 * Why this file exists: Category/SubCategory response shapes, separated
 * from the Prisma model so `deletedAt` (an internal bookkeeping field, not
 * something a client needs) never accidentally serializes into an API
 * response. Create/Update DTOs are aliased from the Zod-inferred input
 * types already defined in validation/category.validation.ts (Sprint 2.1)
 * rather than redeclared — a second, hand-written copy of the same shape
 * would drift from the schema that actually validates it.
 *
 * Dependencies: @prisma/client (types only), category.validation.ts.
 * Future usage: category.service.impl.ts returns these; Sprint 2.3's API
 * routes serialize them directly.
 */

export type CreateCategoryDto = CreateCategoryInput;
export type UpdateCategoryDto = UpdateCategoryInput;

export interface CategoryResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubCategoryResponseDto {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryWithSubCategoriesResponseDto extends CategoryResponseDto {
  subCategories: SubCategoryResponseDto[];
}

export function toCategoryDto(category: Category): CategoryResponseDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export function toSubCategoryDto(subCategory: SubCategory): SubCategoryResponseDto {
  return {
    id: subCategory.id,
    categoryId: subCategory.categoryId,
    name: subCategory.name,
    slug: subCategory.slug,
    sortOrder: subCategory.sortOrder,
    isActive: subCategory.isActive,
    createdAt: subCategory.createdAt,
    updatedAt: subCategory.updatedAt,
  };
}

export function toCategoryWithSubCategoriesDto(
  category: Category & { subCategories: SubCategory[] },
): CategoryWithSubCategoriesResponseDto {
  return {
    ...toCategoryDto(category),
    subCategories: category.subCategories.map(toSubCategoryDto),
  };
}
