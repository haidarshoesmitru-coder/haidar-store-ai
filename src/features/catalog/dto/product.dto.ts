import type { ProductWithRelations } from '@/features/catalog/types';
import type { CreateProductInput, UpdateProductInput } from '@/features/catalog/validation/product.validation';
import type { SearchParamsDto } from '@/features/catalog/dto/pagination.dto';
import { toVariantDto, type VariantResponseDto } from '@/features/catalog/dto/variant.dto';
import { toCategoryDto, type CategoryResponseDto } from '@/features/catalog/dto/category.dto';
import { toBrandDto, type BrandResponseDto } from '@/features/catalog/dto/brand.dto';

/**
 * Why this file exists: the product response shape assembled from its
 * relations (category, brand, images, variants) via the smaller per-entity
 * DTO mappers — composition, not reimplementation, of
 * toCategoryDto/toBrandDto/toVariantDto. `ProductSearchDto` extends the
 * generic `SearchParamsDto` with the filters product search actually
 * supports.
 *
 * Dependencies: catalog/types.ts, product.validation.ts, pagination.dto.ts,
 * variant.dto.ts, category.dto.ts, brand.dto.ts.
 * Future usage: product.service.impl.ts returns ProductResponseDto from
 * every read method; Sprint 2.3's API routes serialize it directly.
 */

export type CreateProductDto = CreateProductInput;
export type UpdateProductDto = UpdateProductInput;

export interface ProductImageDto {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  season: string | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  category: CategoryResponseDto;
  brand: BrandResponseDto | null;
  images: ProductImageDto[];
  variants: VariantResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

/** Lighter shape for list/grid views — omits the full variant/attribute breakdown a detail page needs. */
export interface ProductListItemDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  primaryImageUrl: string | null;
  /** The default variant's price — what a product card actually displays. */
  startingPrice: string | null;
}

export interface ProductSearchDto extends SearchParamsDto {
  categoryId?: string;
  subCategoryId?: string;
  brandId?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  season?: 'WINTER' | 'SUMMER' | 'ALL_SEASON';
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
}

export function toProductDto(product: ProductWithRelations): ProductResponseDto {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    status: product.status,
    season: product.season,
    isFeatured: product.isFeatured,
    isBestSeller: product.isBestSeller,
    isNewArrival: product.isNewArrival,
    category: toCategoryDto(product.category),
    brand: product.brand ? toBrandDto(product.brand) : null,
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.altText,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
    })),
    variants: product.variants.map(toVariantDto),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function toProductListItemDto(product: ProductWithRelations): ProductListItemDto {
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const defaultVariant = product.variants.find((variant) => variant.isDefault) ?? product.variants[0];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    isFeatured: product.isFeatured,
    isBestSeller: product.isBestSeller,
    isNewArrival: product.isNewArrival,
    primaryImageUrl: primaryImage?.url ?? null,
    startingPrice: defaultVariant?.price.toString() ?? null,
  };
}
