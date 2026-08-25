import { db } from '@/shared/lib/db';
import type { ProductVariant, Attribute, VariantAttribute, Inventory, Prisma } from '@prisma/client';
import type { IProductVariantRepository } from '@/features/catalog/repositories/product-variant.repository';
import type { VariantSummary, VariantWithCost } from '@/features/catalog/types';
import type { VariantAttributeInput } from '@/features/catalog/validation/variant.validation';

/**
 * Why this file is named `variant.repository.impl.ts`, not
 * `product-variant.repository.impl.ts`: Sprint 2.1's interface lives in
 * `product-variant.repository.ts` (matching that sprint's file-naming
 * choice); this sprint's spec asks for `variant.repository.ts` as the
 * concrete file name. Renaming the Sprint 2.1 file was out of scope
 * ("do not modify Sprint 2.1"), so this file adopts Sprint 2.2's
 * requested name for the NEW concrete-implementation file while importing
 * the interface from its original location — the shorter "variant" name
 * is what Sprint 2.3's services/routes will actually import day to day.
 *
 * See category.repository.impl.ts for the shared "why not BaseRepository"
 * rationale.
 *
 * Dependencies: db.ts, product-variant.repository.ts (interface),
 * catalog/types.ts, variant.validation.ts.
 * Future usage: constructed by variant.service.ts and product.service.impl.ts.
 */

const VARIANT_INCLUDE = {
  attributes: { include: { attribute: true } },
  inventory: true,
} satisfies Prisma.ProductVariantInclude;

type VariantWithIncludes = ProductVariant & {
  attributes: (VariantAttribute & { attribute: Attribute })[];
  inventory: Inventory | null;
};

function toSummary(variant: VariantWithIncludes): VariantSummary {
  // Explicit field list rather than `const { costPrice, ...rest } = variant`:
  // Sprint 1's ESLint config (untouched by this sprint) doesn't set
  // `ignoreRestSiblings`, so a destructured-and-discarded `costPrice`
  // would itself trip `@typescript-eslint/no-unused-vars`. Listing fields
  // explicitly avoids relying on a rule option that isn't configured.
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    barcode: variant.barcode,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    status: variant.status,
    isDefault: variant.isDefault,
    deletedAt: variant.deletedAt,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
    attributes: variant.attributes,
    inventory: variant.inventory,
  };
}

/**
 * Extended beyond Sprint 2.1's IProductVariantRepository with the
 * duplicate-SKU/barcode checks and product-scoped queries VariantService
 * and ProductService need — see the matching note in
 * category.repository.impl.ts for the full rationale.
 */
export interface IProductVariantRepositoryExtended extends IProductVariantRepository {
  findByProduct(productId: string): Promise<VariantSummary[]>;
  existsBySku(sku: string, excludeId?: string): Promise<boolean>;
  existsByBarcode(barcode: string, excludeId?: string): Promise<boolean>;
  countActiveByProductId(productId: string): Promise<number>;
}

export class PrismaProductVariantRepository implements IProductVariantRepositoryExtended {
  async findById(id: string): Promise<VariantSummary | null> {
    const variant = await db.productVariant.findFirst({
      where: { id, deletedAt: null },
      include: VARIANT_INCLUDE,
    });
    return variant ? toSummary(variant) : null;
  }

  async findByIdForStaff(id: string): Promise<VariantWithCost | null> {
    return db.productVariant.findFirst({
      where: { id, deletedAt: null },
      include: VARIANT_INCLUDE,
    }) as Promise<VariantWithCost | null>;
  }

  async findByProductId(productId: string): Promise<VariantSummary[]> {
    const variants = await db.productVariant.findMany({
      where: { productId, deletedAt: null },
      include: VARIANT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return variants.map(toSummary);
  }

  /** Alias matching this sprint's requested method name — same query as findByProductId. */
  findByProduct(productId: string): Promise<VariantSummary[]> {
    return this.findByProductId(productId);
  }

  async findBySku(sku: string): Promise<VariantSummary | null> {
    const variant = await db.productVariant.findFirst({
      where: { sku, deletedAt: null },
      include: VARIANT_INCLUDE,
    });
    return variant ? toSummary(variant) : null;
  }

  async findByBarcode(barcode: string): Promise<VariantSummary | null> {
    const variant = await db.productVariant.findFirst({
      where: { barcode, deletedAt: null },
      include: VARIANT_INCLUDE,
    });
    return variant ? toSummary(variant) : null;
  }

  async create(
    productId: string,
    input: Omit<ProductVariant, 'id' | 'productId' | 'deletedAt' | 'createdAt' | 'updatedAt'>,
    attributes: VariantAttributeInput[],
  ): Promise<VariantWithCost> {
    return db.productVariant.create({
      data: {
        ...input,
        productId,
        attributes: {
          create: attributes.map((attribute) => ({
            attributeId: attribute.attributeId,
            value: attribute.value,
          })),
        },
      },
      include: VARIANT_INCLUDE,
    }) as Promise<VariantWithCost>;
  }

  update(
    id: string,
    input: Partial<Omit<ProductVariant, 'id' | 'productId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<VariantWithCost> {
    return db.productVariant.update({
      where: { id },
      data: input,
      include: VARIANT_INCLUDE,
    }) as Promise<VariantWithCost>;
  }

  async softDelete(id: string): Promise<void> {
    await db.productVariant.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  }

  /** Extra — backs VariantService's DuplicateSku rule. */
  async existsBySku(sku: string, excludeId?: string): Promise<boolean> {
    const count = await db.productVariant.count({
      where: { sku, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return count > 0;
  }

  /** Extra — backs VariantService's DuplicateBarcode rule. */
  async existsByBarcode(barcode: string, excludeId?: string): Promise<boolean> {
    const count = await db.productVariant.count({
      where: { barcode, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return count > 0;
  }

  /** Extra — backs ProductService's "must retain at least one variant" rule. */
  async countActiveByProductId(productId: string): Promise<number> {
    return db.productVariant.count({ where: { productId, deletedAt: null } });
  }
}
