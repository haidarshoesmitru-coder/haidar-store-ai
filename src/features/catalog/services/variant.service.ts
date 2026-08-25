import {
  PrismaProductVariantRepository,
  type IProductVariantRepositoryExtended,
} from '@/features/catalog/repositories/variant.repository.impl';
import { InventoryService } from '@/features/catalog/services/inventory.service.impl';
import type { VariantSummary, VariantWithCost } from '@/features/catalog/types';
import type { CreateVariantInput, UpdateVariantInput } from '@/features/catalog/validation/variant.validation';
import { DuplicateSkuError, DuplicateBarcodeError, InvalidBarcodeError, VariantNotFoundError, ProductMustHaveAtLeastOneVariantError } from '@/features/catalog/errors';
import { logger } from '@/shared/lib/logger';
import { stripUndefined } from '@/shared/utils/strip-undefined';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Why this file exists AND why it's a single file, unlike the
 * Category/Brand/Product services: `IVariantService` has no Sprint 2.1
 * predecessor — Sprint 2.1 folded variant read/write responsibility into
 * `IProductService` (variants were treated as part of the Product
 * aggregate). This sprint's spec explicitly asks for a standalone
 * `VariantService` with `createVariant`/`updateVariant`, so this file
 * defines that interface fresh, right next to its one implementation —
 * there's no prior contract to keep separate from a new one, so splitting
 * interface/impl into two files here would be process for its own sake.
 *
 * Business rules owned here: duplicate SKU, duplicate barcode, barcode
 * format (defense in depth — see the comment on `validateBarcode` for why
 * this duplicates part of what Zod could check), and orchestrating
 * inventory initialization for every new variant.
 *
 * Dependencies: variant.repository.impl.ts, inventory.service.impl.ts,
 * catalog/errors.ts, logger.ts.
 * Future usage: constructed by Sprint 2.3's Variant API routes; called by
 * ProductService when creating a product's variants.
 */

export interface IVariantService {
  getById(id: string): Promise<VariantSummary | null>;
  getByIdForStaff(id: string): Promise<VariantWithCost | null>;
  getByProduct(productId: string): Promise<VariantSummary[]>;
  createVariant(productId: string, input: CreateVariantInput): Promise<VariantWithCost>;
  updateVariant(id: string, input: UpdateVariantInput): Promise<VariantWithCost>;
  deleteVariant(id: string): Promise<void>;
}

const BARCODE_PATTERN = /^\d{8}$|^\d{12,14}$/;

export class VariantService implements IVariantService {
  constructor(
    private readonly variantRepository: IProductVariantRepositoryExtended = new PrismaProductVariantRepository(),
    private readonly inventoryService: InventoryService = new InventoryService(),
  ) {}

  async getById(id: string): Promise<VariantSummary | null> {
    return this.variantRepository.findById(id);
  }

  async getByIdForStaff(id: string): Promise<VariantWithCost | null> {
    return this.variantRepository.findByIdForStaff(id);
  }

  async getByProduct(productId: string): Promise<VariantSummary[]> {
    return this.variantRepository.findByProduct(productId);
  }

  async createVariant(productId: string, input: CreateVariantInput): Promise<VariantWithCost> {
    await this.assertNoDuplicates(input.sku, input.barcode);

    const variant = await this.variantRepository.create(
      productId,
      {
        sku: input.sku ?? null,
        barcode: input.barcode ?? null,
        price: new Decimal(input.price),
        compareAtPrice: input.compareAtPrice !== undefined ? new Decimal(input.compareAtPrice) : null,
        costPrice: input.costPrice !== undefined ? new Decimal(input.costPrice) : null,
        status: 'ACTIVE',
        isDefault: input.isDefault,
      },
      input.attributes,
    );

    // Every variant gets an Inventory row the moment it exists — a variant
    // with no Inventory row would be a variant nothing can ever sell or
    // stock-check, so this is not optional orchestration.
    await this.inventoryService.initializeForVariant(variant.id);
    if (input.initialQuantity > 0) {
      await this.inventoryService.stockIn({
        variantId: variant.id,
        quantity: input.initialQuantity,
        note: 'Initial stock on variant creation',
        referenceType: 'MANUAL',
      });
    }

    logger.info('Variant created', { variantId: variant.id, productId, sku: variant.sku });
    return variant;
  }

  async updateVariant(id: string, input: UpdateVariantInput): Promise<VariantWithCost> {
    const existing = await this.variantRepository.findByIdForStaff(id);
    if (!existing) throw new VariantNotFoundError(id);

    if (input.sku !== undefined || input.barcode !== undefined) {
      await this.assertNoDuplicates(
        input.sku !== undefined ? input.sku : (existing.sku ?? undefined),
        input.barcode !== undefined ? input.barcode : (existing.barcode ?? undefined),
        id,
      );
    }

    const variant = await this.variantRepository.update(
      id,
      stripUndefined({
        sku: input.sku,
        barcode: input.barcode,
        price: input.price !== undefined ? new Decimal(input.price) : undefined,
        compareAtPrice: input.compareAtPrice !== undefined ? new Decimal(input.compareAtPrice) : undefined,
        costPrice: input.costPrice !== undefined ? new Decimal(input.costPrice) : undefined,
        status: input.status,
        isDefault: input.isDefault,
      }),
    );

    logger.info('Variant updated', { variantId: id });
    return variant;
  }

  async deleteVariant(id: string): Promise<void> {
    const existing = await this.variantRepository.findById(id);
    if (!existing) throw new VariantNotFoundError(id);

    // A product with zero variants has nothing sellable — the same rule
    // Sprint 2.1's Zod schema enforces at product-creation time
    // (`variants: z.array(...).min(1, ...)`) has to be enforced here too,
    // since deletion is the other way that count could reach zero.
    const remainingCount = await this.variantRepository.countActiveByProductId(existing.productId);
    if (remainingCount <= 1) {
      logger.warn('Variant deletion rejected: would leave product with no variants', {
        variantId: id,
        productId: existing.productId,
      });
      throw new ProductMustHaveAtLeastOneVariantError(existing.productId);
    }

    await this.variantRepository.softDelete(id);
    logger.info('Variant deleted (soft)', { variantId: id });
  }

  private async assertNoDuplicates(sku?: string, barcode?: string, excludeId?: string): Promise<void> {
    if (barcode) {
      // Defense in depth: Sprint 2.1's validation schema doesn't enforce a
      // barcode format (it only checks max length), so the service layer
      // is the only place this is actually validated today. Flagged as a
      // gap for a future pass to migrate into the Zod schema directly,
      // rather than silently relying on this check alone.
      if (!BARCODE_PATTERN.test(barcode)) {
        throw new InvalidBarcodeError(barcode);
      }
      const barcodeTaken = await this.variantRepository.existsByBarcode(barcode, excludeId);
      if (barcodeTaken) {
        logger.warn('Variant rejected: duplicate barcode', { barcode });
        throw new DuplicateBarcodeError(barcode);
      }
    }

    if (sku) {
      const skuTaken = await this.variantRepository.existsBySku(sku, excludeId);
      if (skuTaken) {
        logger.warn('Variant rejected: duplicate SKU', { sku });
        throw new DuplicateSkuError(sku);
      }
    }
  }
}
