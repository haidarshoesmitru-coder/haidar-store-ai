import { z } from 'zod';
import { createVariantSchema } from '@/features/catalog/validation/variant.validation';

/**
 * Why this file exists: input validation for Product mutations. Notably
 * composes `createVariantSchema` (nested `variants` array) rather than
 * requiring a separate round trip to create a product's default variant —
 * matches how the API architecture's Catalog module description expects
 * product creation to work (base fields; variants can be added at the same
 * time or separately).
 *
 * Dependencies: zod, variant.validation.ts.
 * Future usage: Sprint 2.2's product service and API routes.
 */

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  subCategoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required.').max(200),
  slug: z.string().regex(slugPattern, 'Slug must be lowercase, alphanumeric, hyphen-separated.').max(220),
  description: z.string().max(5000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
  season: z.enum(['WINTER', 'SUMMER', 'ALL_SEASON']).optional(),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  /** At least one variant required — a product with zero variants has nothing sellable. */
  variants: z.array(createVariantSchema).min(1, 'At least one variant is required.'),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.omit({ variants: true }).partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productImageInputSchema = z.object({
  url: z.string().url(),
  variantId: z.string().uuid().optional(),
  altText: z.string().max(200).optional(),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});
export type ProductImageInput = z.infer<typeof productImageInputSchema>;

export const productListQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  subCategoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(200).default(24),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
