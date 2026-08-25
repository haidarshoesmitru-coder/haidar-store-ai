import type { Brand } from '@prisma/client';
import type { CreateBrandInput, UpdateBrandInput } from '@/features/catalog/validation/brand.validation';

export type CreateBrandDto = CreateBrandInput;
export type UpdateBrandDto = UpdateBrandInput;

export interface BrandResponseDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toBrandDto(brand: Brand): BrandResponseDto {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    isActive: brand.isActive,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}
