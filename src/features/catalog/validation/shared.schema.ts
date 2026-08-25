import { z } from 'zod';

/**
 * Why this file exists: Sprint 2.2 asks for reusable field-level
 * validators (Price, Slug, SKU, Barcode, UUID, Name, Description, Status,
 * Season) — a distinct, smaller-grained concern from the composed
 * request-body schemas already in `*.validation.ts` (Sprint 2.1). Those
 * files validate "the shape of a create-product request"; this file
 * validates "what a valid price looks like," reused by any schema that
 * needs a price field. Every field schema in `*.validation.ts` that
 * duplicated a pattern inline (e.g. the slug regex) is a candidate to be
 * rewritten against this file in a later pass — not done here, since
 * editing Sprint 2.1's files is out of scope for this sprint. New Sprint
 * 2.2 schemas (dto/, this validation layer's own additions) use these
 * from the start.
 *
 * Dependencies: zod.
 * Future usage: every new validation schema in this module; Sprint 2.1's
 * existing schemas can be migrated to import from here in a future
 * cleanup pass without changing their external behavior.
 */

export const uuidSchema = z.string().uuid('Must be a valid UUID.');

export const slugSchema = z
  .string()
  .min(1, 'Slug is required.')
  .max(220)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase, alphanumeric, hyphen-separated.');

export const nameSchema = z.string().min(1, 'Name is required.').max(200);

export const descriptionSchema = z.string().max(5000);

export const priceSchema = z
  .number()
  .positive('Price must be greater than zero.')
  .multipleOf(0.01, 'Price cannot have more than 2 decimal places.');

export const optionalPriceSchema = priceSchema.optional();

/** SKUs are store-defined, alphanumeric with optional hyphens/underscores — not a fixed format. */
export const skuSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9_-]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores.');

export const optionalSkuSchema = skuSchema.optional();

/** EAN-8, UPC-A/EAN-13, or GTIN-14 — the common retail barcode lengths. */
export const barcodeSchema = z
  .string()
  .regex(/^\d{8}$|^\d{12,14}$/, 'Barcode must be 8, 12, 13, or 14 digits.');

export const optionalBarcodeSchema = barcodeSchema.optional();

export const productStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);

export const productSeasonSchema = z.enum(['WINTER', 'SUMMER', 'ALL_SEASON']);

export const variantStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const nonNegativeIntSchema = z.number().int().nonnegative();

export const positiveIntSchema = z.number().int().positive();
