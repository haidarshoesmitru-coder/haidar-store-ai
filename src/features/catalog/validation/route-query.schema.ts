import { z } from 'zod';
import { uuidSchema } from '@/features/catalog/validation/shared.schema';

/**
 * Why this file exists: Sprint 2.2's `ProductSearchDto` (dto/product.dto.ts)
 * is a plain TypeScript interface — it was never backed by a Zod schema,
 * because Sprint 2.2's scope was the service/repository layer, not HTTP
 * query-string parsing. This sprint explicitly requires validating query
 * params ("never trust client input"), and query strings arrive as
 * `string | string[] | undefined` regardless of the target field's real
 * type — so this file defines the actual parsing/coercion boundary
 * (`"true"` -> `true`, `"19.99"` -> `19.99`) that turns a raw
 * `URLSearchParams` into a value shaped like `ProductSearchDto`.
 *
 * New file rather than editing dto/product.dto.ts (Sprint 2.2, untouched) —
 * this is route-layer parsing, a different concern from the DTO's shape.
 *
 * Dependencies: zod, shared.schema.ts (Sprint 2.2, read-only import).
 * Future usage: parsed by every list/search route in this sprint's API
 * layer via api/query.ts's `parseSearchParams`.
 */

const booleanParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

const numberParam = z
  .string()
  .optional()
  .transform((value) => (value === undefined ? undefined : Number(value)))
  .pipe(z.number().finite().optional());

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: numberParam.pipe(z.number().int().positive().max(200).optional()),
});

export const productSortSchema = z.enum(['price_asc', 'price_desc', 'newest', 'best_selling']).optional();

export const productSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(200).optional(),
  categoryId: uuidSchema.optional(),
  subCategoryId: uuidSchema.optional(),
  brandId: uuidSchema.optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  season: z.enum(['WINTER', 'SUMMER', 'ALL_SEASON']).optional(),
  isFeatured: booleanParam,
  isBestSeller: booleanParam,
  isNewArrival: booleanParam,
  minPrice: numberParam,
  maxPrice: numberParam,
  sort: productSortSchema,
});
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const categoryListQuerySchema = paginationQuerySchema;
export const brandListQuerySchema = paginationQuerySchema;
export const variantListQuerySchema = paginationQuerySchema;
export const inventoryHistoryQuerySchema = paginationQuerySchema;
