import { z } from 'zod';

/**
 * Why this file exists: input validation for Category/SubCategory
 * mutations, colocated with the feature per the pattern established in
 * features/auth/validation.ts. These are the schemas the (not-yet-built)
 * Category service will call `validate()` with.
 *
 * Dependencies: zod.
 * Future usage: Sprint 2.2's category service and API routes.
 */

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required.').max(120),
  slug: z.string().regex(slugPattern, 'Slug must be lowercase, alphanumeric, hyphen-separated.').max(140),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().default(0),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const createSubCategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1, 'Name is required.').max(120),
  slug: z.string().regex(slugPattern, 'Slug must be lowercase, alphanumeric, hyphen-separated.').max(140),
  sortOrder: z.number().int().default(0),
});
export type CreateSubCategoryInput = z.infer<typeof createSubCategorySchema>;

export const updateSubCategorySchema = createSubCategorySchema
  .omit({ categoryId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateSubCategoryInput = z.infer<typeof updateSubCategorySchema>;
