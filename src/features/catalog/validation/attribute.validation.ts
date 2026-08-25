import { z } from 'zod';

/**
 * Why this file exists: input validation for the new Attribute management
 * endpoints this sprint adds (list/create) — filling the gap flagged in
 * Sprint 2.1's own docs. New file, matching the pattern of every other
 * `*.validation.ts` file in this module.
 */

export const createAttributeSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100),
  code: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, 'Code must be lowercase, alphanumeric, underscore-separated (e.g. "shoe_size").'),
  dataType: z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT']).default('TEXT'),
});
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;
