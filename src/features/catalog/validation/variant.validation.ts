import { z } from 'zod';

/**
 * Why this file exists: variant creation is where the "no hardcoded
 * Size/Color" requirement actually gets enforced at the input boundary.
 * `variantAttributeSchema` accepts an arbitrary attributeId + value pair
 * rather than named `size`/`color` fields — the same schema validates a
 * shoe's Size+Color variant and a makeup item's Shade variant without
 * change.
 *
 * Dependencies: zod.
 * Future usage: product.validation.ts composes `createVariantSchema` for
 * nested variant creation; Sprint 2.2's variant service and API routes use
 * these directly for standalone variant mutations.
 */

export const variantAttributeInputSchema = z.object({
  attributeId: z.string().uuid(),
  value: z.string().min(1, 'Value is required.').max(200),
});
export type VariantAttributeInput = z.infer<typeof variantAttributeInputSchema>;

export const createVariantSchema = z.object({
  sku: z.string().max(60).optional(),
  barcode: z.string().max(60).optional(),
  price: z.number().positive('Price must be greater than zero.'),
  compareAtPrice: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional(),
  isDefault: z.boolean().default(false),
  attributes: z.array(variantAttributeInputSchema).default([]),
  /** Initial stock, if known at creation time — optional since a new variant may start at zero. */
  initialQuantity: z.number().int().nonnegative().default(0),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = createVariantSchema
  .omit({ attributes: true, initialQuantity: true })
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  });
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
