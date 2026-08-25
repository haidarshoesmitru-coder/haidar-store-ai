import type { InventoryTransaction } from '@prisma/client';
import type { InventoryWithConfig, CursorPage } from '@/features/catalog/types';
import type {
  RecordInventoryTransactionInput,
  SetLowStockConfigurationInput,
} from '@/features/catalog/validation/inventory.validation';

/**
 * Why this file exists: the business-rule layer over
 * IInventoryRepository's single write path. The repository will insert
 * whatever transaction it's given; this service is where the actual rule
 * lives — a STOCK_OUT/SALE/ADJUSTMENT transaction that would drive
 * `quantityOnHand` negative is rejected (ConflictError) before the
 * repository is ever called. Matches the DB design's stated constraint
 * ("ProductVariant.stock_quantity >= 0") being enforced at the service
 * layer, with the database check constraint as the last-resort backstop.
 *
 * Dependencies: catalog/types.ts, inventory.validation.ts.
 * Future usage: implemented in Sprint 2.2; depended on by IProductService
 * (to initialize stock on variant creation) and, later, the Orders module
 * (SALE/RETURN transactions on order placement/cancellation).
 */
export interface IInventoryService {
  getByVariantId(variantId: string): Promise<InventoryWithConfig | null>;

  /** Rejects if the resulting quantityOnHand would go negative. */
  recordTransaction(input: RecordInventoryTransactionInput): Promise<InventoryTransaction>;

  getTransactionHistory(
    variantId: string,
    cursor?: string,
    limit?: number,
  ): Promise<CursorPage<InventoryTransaction>>;

  listLowStock(): Promise<InventoryWithConfig[]>;

  setLowStockConfiguration(input: SetLowStockConfigurationInput): Promise<void>;
}
