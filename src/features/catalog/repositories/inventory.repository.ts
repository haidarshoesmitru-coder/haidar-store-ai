import type { InventoryTransaction, LowStockConfiguration } from '@prisma/client';
import type { InventoryWithConfig, CursorPage } from '@/features/catalog/types';

/**
 * Why this file exists: contract for the Inventory aggregate (Inventory +
 * InventoryTransaction + LowStockConfiguration) — grouped because all
 * three exist only in relation to a variant's stock lifecycle, mirroring
 * the "one write path for stock" decision from the API architecture: this
 * is the one repository allowed to touch `quantityOnHand`.
 *
 * Note `recordTransaction` is the ONLY mutation method on this interface —
 * there is deliberately no generic `updateInventory(id, data)` method that
 * could let a future caller set `quantityOnHand` directly. Every stock
 * change must go through a transaction record, enforced at the contract
 * level, not just by convention.
 *
 * Dependencies: @prisma/client (types only), catalog/types.ts.
 * Future usage: implemented in Sprint 2.2; depended on by IInventoryService
 * and, later, the Orders module (for sale/return transactions).
 */
export interface IInventoryRepository {
  findByVariantId(variantId: string): Promise<InventoryWithConfig | null>;
  /** Initializes the zero-stock row for a newly created variant. */
  initializeForVariant(variantId: string): Promise<InventoryWithConfig>;

  /**
   * The single write path for stock. Implementations must write the
   * InventoryTransaction row and update Inventory.quantityOnHand in one
   * database transaction — never as two separate operations.
   */
  recordTransaction(
    variantId: string,
    input: Omit<InventoryTransaction, 'id' | 'inventoryId' | 'createdAt'>,
  ): Promise<InventoryTransaction>;

  findTransactionHistory(
    variantId: string,
    cursor?: string,
    limit?: number,
  ): Promise<CursorPage<InventoryTransaction>>;

  findLowStock(): Promise<InventoryWithConfig[]>;

  setLowStockConfiguration(
    variantId: string,
    input: Omit<LowStockConfiguration, 'id' | 'variantId' | 'updatedAt'>,
  ): Promise<LowStockConfiguration>;
}
