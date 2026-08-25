import type { VariantSummary, VariantWithCost } from '@/features/catalog/types';
import type { CreateVariantInput, UpdateVariantInput } from '@/features/catalog/validation/variant.validation';

/**
 * Why this file exists: the variant response shape, built from
 * `VariantSummary` (Sprint 2.1's cost-safe type) — this file's job is
 * flattening that into a plain serializable DTO (attributes as a simple
 * name/value array, not the raw Prisma relation shape) rather than
 * introducing new access-control logic; that logic already lives in
 * types.ts and product-variant.repository.ts (Sprint 2.1's
 * `findById` vs `findByIdForStaff` split).
 *
 * Dependencies: catalog/types.ts, variant.validation.ts.
 * Future usage: product.dto.ts embeds `VariantResponseDto[]` in
 * `ProductResponseDto`; variant.service.ts returns these directly.
 */

export type CreateVariantDto = CreateVariantInput;
export type UpdateVariantDto = UpdateVariantInput;

export interface VariantAttributeDto {
  attributeId: string;
  name: string;
  code: string;
  value: string;
}

export interface VariantResponseDto {
  id: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  status: string;
  isDefault: boolean;
  attributes: VariantAttributeDto[];
  stockOnHand: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Adds cost price / margin — manager/admin callers only, per the RBAC rule from the API architecture. */
export interface VariantWithCostResponseDto extends VariantResponseDto {
  costPrice: string | null;
}

function toAttributeDtos(variant: VariantSummary | VariantWithCost): VariantAttributeDto[] {
  return variant.attributes.map((entry) => ({
    attributeId: entry.attributeId,
    name: entry.attribute.name,
    code: entry.attribute.code,
    value: entry.value,
  }));
}

export function toVariantDto(variant: VariantSummary): VariantResponseDto {
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    barcode: variant.barcode,
    price: variant.price.toString(),
    compareAtPrice: variant.compareAtPrice?.toString() ?? null,
    status: variant.status,
    isDefault: variant.isDefault,
    attributes: toAttributeDtos(variant),
    stockOnHand: variant.inventory?.quantityOnHand ?? null,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

export function toVariantWithCostDto(variant: VariantWithCost): VariantWithCostResponseDto {
  return {
    ...toVariantDto(variant),
    costPrice: variant.costPrice?.toString() ?? null,
  };
}
