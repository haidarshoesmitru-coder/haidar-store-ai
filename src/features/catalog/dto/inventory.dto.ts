import type { InventoryTransaction } from '@prisma/client';
import type { InventoryWithConfig } from '@/features/catalog/types';

/**
 * Why this file exists: inventory response shapes. `stockIn`/`stockOut`/
 * `adjustInventory` DTOs are deliberately three distinct, narrower request
 * shapes (not one generic "record a transaction" DTO like Sprint 2.1's
 * `RecordInventoryTransactionInput`) — Sprint 2.2's service layer exposes
 * three separate business operations with three different validation
 * needs (stockOut/adjustInventory-that-reduces-quantity need to check
 * available stock; stockIn never does), so the DTOs mirror that at the
 * boundary rather than forcing every caller to pick the right `type`
 * enum value by hand.
 *
 * Dependencies: catalog/types.ts, @prisma/client (types only).
 * Future usage: inventory.service.impl.ts's three business methods take
 * these as input; Sprint 2.3's API routes for stock-in/stock-out/adjust.
 */

export interface StockInDto {
  variantId: string;
  quantity: number;
  note?: string;
  referenceType?: 'SUPPLIER_DELIVERY' | 'MANUAL';
  referenceId?: string;
  performedByUserId?: string;
}

export interface StockOutDto {
  variantId: string;
  quantity: number;
  note?: string;
  referenceType?: 'ORDER' | 'MANUAL';
  referenceId?: string;
  performedByUserId?: string;
}

export interface AdjustInventoryDto {
  variantId: string;
  /** Signed — positive corrects stock upward, negative corrects it downward. */
  quantityDelta: number;
  note: string;
  performedByUserId?: string;
}

export interface InventoryResponseDto {
  variantId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  updatedAt: Date;
}

export interface InventoryTransactionResponseDto {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  createdAt: Date;
}

export function toInventoryDto(inventory: InventoryWithConfig): InventoryResponseDto {
  const threshold = inventory.lowStockConfig?.isEnabled ? inventory.lowStockConfig.threshold : null;

  return {
    variantId: inventory.variantId,
    quantityOnHand: inventory.quantityOnHand,
    quantityReserved: inventory.quantityReserved,
    quantityAvailable: inventory.quantityOnHand - inventory.quantityReserved,
    lowStockThreshold: threshold,
    isLowStock: threshold !== null && inventory.quantityOnHand <= threshold,
    updatedAt: inventory.updatedAt,
  };
}

export function toInventoryTransactionDto(transaction: InventoryTransaction): InventoryTransactionResponseDto {
  return {
    id: transaction.id,
    type: transaction.type,
    quantity: transaction.quantity,
    note: transaction.note,
    createdAt: transaction.createdAt,
  };
}
