import type { InventoryTransaction } from '@prisma/client';
import type { IInventoryService } from '@/features/catalog/services/inventory.service';
import {
  PrismaInventoryRepository,
  type IInventoryRepositoryExtended,
} from '@/features/catalog/repositories/inventory.repository.impl';
import type { InventoryWithConfig, CursorPage } from '@/features/catalog/types';
import type {
  RecordInventoryTransactionInput,
  SetLowStockConfigurationInput,
} from '@/features/catalog/validation/inventory.validation';
import type { StockInDto, StockOutDto, AdjustInventoryDto } from '@/features/catalog/dto/inventory.dto';
import { InsufficientStockError, VariantNotFoundError } from '@/features/catalog/errors';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: the business-rule layer over
 * IInventoryRepository's single write path (`recordTransaction`). Every
 * public method here — `stockIn`, `stockOut`, `adjustInventory` (this
 * sprint's requested names) — funnels through one private
 * `applyTransaction` method, which is where "prevent negative stock" and
 * "automatically create inventory transactions" actually happen. There is
 * exactly one place in this file that calls the repository's write path.
 *
 * Dependencies: inventory.repository.impl.ts, catalog/errors.ts, logger.ts.
 * Future usage: constructed by Sprint 2.3's Inventory API routes; called
 * by ProductService/VariantService to seed stock on variant creation;
 * later, the Orders module calls stockOut/stockIn for SALE/RETURN.
 */
export class InventoryService implements IInventoryService {
  constructor(private readonly inventoryRepository: IInventoryRepositoryExtended = new PrismaInventoryRepository()) {}

  async getByVariantId(variantId: string): Promise<InventoryWithConfig | null> {
    return this.inventoryRepository.findByVariantId(variantId);
  }

  /** Called by ProductService/VariantService right after a variant is created. */
  async initializeForVariant(variantId: string): Promise<InventoryWithConfig> {
    return this.inventoryRepository.initializeForVariant(variantId);
  }

  async stockIn(input: StockInDto): Promise<InventoryTransaction> {
    return this.applyTransaction({
      variantId: input.variantId,
      type: 'STOCK_IN',
      quantity: Math.abs(input.quantity),
      note: input.note ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      performedByUserId: input.performedByUserId ?? null,
    });
  }

  async stockOut(input: StockOutDto): Promise<InventoryTransaction> {
    return this.applyTransaction({
      variantId: input.variantId,
      type: 'STOCK_OUT',
      quantity: -Math.abs(input.quantity),
      note: input.note ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      performedByUserId: input.performedByUserId ?? null,
    });
  }

  async adjustInventory(input: AdjustInventoryDto): Promise<InventoryTransaction> {
    return this.applyTransaction({
      variantId: input.variantId,
      type: 'ADJUSTMENT',
      quantity: input.quantityDelta,
      note: input.note,
      referenceType: null,
      referenceId: null,
      performedByUserId: input.performedByUserId ?? null,
    });
  }

  /**
   * The one place `recordTransaction` (the repository's single write
   * path) is called from this service. Every public mutation method above
   * routes through here, which is what makes "prevent negative stock" and
   * "log every inventory change" true for all of them at once instead of
   * three separately-maintained rules.
   */
  private async applyTransaction(input: {
    variantId: string;
    type: 'STOCK_IN' | 'STOCK_OUT' | 'SALE' | 'RETURN' | 'ADJUSTMENT';
    quantity: number;
    note: string | null;
    referenceType: string | null;
    referenceId: string | null;
    performedByUserId: string | null;
  }): Promise<InventoryTransaction> {
    if (input.quantity < 0) {
      const currentStock = await this.inventoryRepository.getCurrentStock(input.variantId);
      if (currentStock === null) {
        throw new VariantNotFoundError(input.variantId);
      }
      const resultingStock = currentStock + input.quantity; // quantity is negative here
      if (resultingStock < 0) {
        logger.warn('Inventory transaction rejected: would go negative', {
          variantId: input.variantId,
          currentStock,
          requestedChange: input.quantity,
        });
        throw new InsufficientStockError(input.variantId, Math.abs(input.quantity), currentStock);
      }
    }

    const transaction = await this.inventoryRepository.recordTransaction(input.variantId, {
      type: input.type,
      quantity: input.quantity,
      note: input.note,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      performedByUserId: input.performedByUserId,
    });

    logger.info('Inventory transaction recorded', {
      variantId: input.variantId,
      type: input.type,
      quantity: input.quantity,
    });

    return transaction;
  }

  async getTransactionHistory(
    variantId: string,
    cursor?: string,
    limit?: number,
  ): Promise<CursorPage<InventoryTransaction>> {
    return this.inventoryRepository.findTransactionHistory(variantId, cursor, limit);
  }

  async listLowStock(): Promise<InventoryWithConfig[]> {
    return this.inventoryRepository.findLowStock();
  }

  async setLowStockConfiguration(input: SetLowStockConfigurationInput): Promise<void> {
    await this.inventoryRepository.setLowStockConfiguration(input.variantId, {
      threshold: input.threshold,
      isEnabled: input.isEnabled,
    });
    logger.info('Low stock configuration updated', { variantId: input.variantId, threshold: input.threshold });
  }

  // --- IInventoryService (Sprint 2.1 contract) — dispatches to applyTransaction by type ---
  recordTransaction(input: RecordInventoryTransactionInput): Promise<InventoryTransaction> {
    return this.applyTransaction({
      variantId: input.variantId,
      type: input.type,
      quantity: input.quantity,
      note: input.note ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      performedByUserId: null,
    });
  }
}
