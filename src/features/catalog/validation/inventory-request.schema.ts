import { z } from 'zod';
import { uuidSchema, positiveIntSchema } from '@/features/catalog/validation/shared.schema';

/**
 * Why this file exists: Sprint 2.2's `StockInDto`/`StockOutDto`/
 * `AdjustInventoryDto` (dto/inventory.dto.ts) are plain TypeScript
 * interfaces, not backed by Zod — same situation as `ProductSearchDto`
 * (see route-query.schema.ts). This sprint's spec requires validating
 * every request body, so these are the actual runtime-checked schemas
 * behind the three inventory mutation endpoints.
 *
 * Dependencies: zod, shared.schema.ts (Sprint 2.2, read-only import).
 * Future usage: parsed by the three inventory mutation routes.
 */

export const stockInRequestSchema = z.object({
  variantId: uuidSchema,
  quantity: positiveIntSchema,
  note: z.string().max(500).optional(),
  referenceType: z.enum(['SUPPLIER_DELIVERY', 'MANUAL']).optional(),
  referenceId: z.string().optional(),
});
export type StockInRequest = z.infer<typeof stockInRequestSchema>;

export const stockOutRequestSchema = z.object({
  variantId: uuidSchema,
  quantity: positiveIntSchema,
  note: z.string().max(500).optional(),
  referenceType: z.enum(['ORDER', 'MANUAL']).optional(),
  referenceId: z.string().optional(),
});
export type StockOutRequest = z.infer<typeof stockOutRequestSchema>;

export const adjustInventoryRequestSchema = z.object({
  variantId: uuidSchema,
  quantityDelta: z.number().int().refine((value) => value !== 0, 'Adjustment cannot be zero.'),
  note: z.string().min(1, 'A note is required for manual adjustments.').max(500),
});
export type AdjustInventoryRequest = z.infer<typeof adjustInventoryRequestSchema>;
