import type { ProductVariant } from '@prisma/client';
import type { VariantSummary, VariantWithCost } from '@/features/catalog/types';
import type { VariantAttributeInput } from '@/features/catalog/validation/variant.validation';

/**
 * Why this file exists: contract for ProductVariant + VariantAttribute —
 * grouped for the same reason as Product/ProductImage: a VariantAttribute
 * has no independent lifecycle apart from the variant it describes.
 *
 * Two find methods instead of one (`findByIdForStaff` vs `findById`) is a
 * deliberate contract-level decision, not an oversight: it makes the
 * cost-price access rule (§24 of the API architecture — manager/admin
 * only) impossible to get wrong by forgetting a field filter at the call
 * site. The safe method is the default name; the privileged one is named
 * to make its extra access obvious wherever it's called.
 *
 * Dependencies: @prisma/client (types only), catalog/types.ts,
 * variant.validation.ts.
 * Future usage: implemented in Sprint 2.2; depended on by IProductService
 * and the future Inventory module.
 */
export interface IProductVariantRepository {
  /** Cost-price omitted — safe for any authenticated role. */
  findById(id: string): Promise<VariantSummary | null>;
  /** Includes cost price — caller MUST have already enforced manager/admin RBAC. */
  findByIdForStaff(id: string): Promise<VariantWithCost | null>;
  findByProductId(productId: string): Promise<VariantSummary[]>;
  findBySku(sku: string): Promise<VariantSummary | null>;
  findByBarcode(barcode: string): Promise<VariantSummary | null>;

  create(
    productId: string,
    input: Omit<ProductVariant, 'id' | 'productId' | 'deletedAt' | 'createdAt' | 'updatedAt'>,
    attributes: VariantAttributeInput[],
  ): Promise<VariantWithCost>;
  update(id: string, input: Partial<Omit<ProductVariant, 'id' | 'productId' | 'createdAt' | 'updatedAt'>>): Promise<VariantWithCost>;
  softDelete(id: string): Promise<void>;
}
