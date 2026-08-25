import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createBrandSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(120),
  slug: z.string().regex(slugPattern, 'Slug must be lowercase, alphanumeric, hyphen-separated.').max(140),
  logoUrl: z.string().url().optional(),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
