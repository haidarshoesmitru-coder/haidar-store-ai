import { z } from 'zod';

/**
 * Why this file exists: `recordInventoryTransactionSchema` is the one
 * input shape behind every kind of stock change (manual stock-in, sale,
 * return, adjustment) — matching the API architecture's §10 decision that
 * there is exactly one write path for stock, whatever the reason. A
 * dedicated schema per transaction type was considered and rejected: the
 * shape genuinely doesn't vary by type, only the `type` value and whether
 * `referenceId` is populated (present for SALE/RETURN, absent for manual
 * STOCK_IN/ADJUSTMENT) — splitting it would be duplication without benefit.
 *
 * Dependencies: zod.
 * Future usage: Sprint 2.2's inventory service and API routes.
 */

export const recordInventoryTransactionSchema = z.object({
  variantId: z.string().uuid(),
  type: z.enum(['STOCK_IN', 'STOCK_OUT', 'SALE', 'RETURN', 'ADJUSTMENT']),
  /** Signed: positive for stock added, negative for stock removed. Never zero. */
  quantity: z.number().int().refine((value) => value !== 0, 'Quantity cannot be zero.'),
  note: z.string().max(500).optional(),
  referenceType: z.enum(['ORDER', 'MANUAL', 'SUPPLIER_DELIVERY', 'CORRECTION']).optional(),
  referenceId: z.string().uuid().optional(),
});
export type RecordInventoryTransactionInput = z.infer<typeof recordInventoryTransactionSchema>;

export const setLowStockConfigurationSchema = z.object({
  variantId: z.string().uuid(),
  threshold: z.number().int().nonnegative(),
  isEnabled: z.boolean().default(true),
});
export type SetLowStockConfigurationInput = z.infer<typeof setLowStockConfigurationSchema>;
