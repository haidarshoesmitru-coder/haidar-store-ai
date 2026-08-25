import type { ZodSchema } from 'zod';
import { ValidationError, type ErrorDetail } from '@/shared/lib/errors';

/**
 * Why this file exists: every feature has its own Zod schemas
 * (features/auth/validation.ts today; catalog, orders, etc. later), but
 * they all need to fail the same way — a ValidationError carrying every
 * failing field at once, per the API design's validation strategy (§18:
 * "return all failing fields at once, not the first one found"). This is
 * the one function that turns "Zod result" into "app error shape,"
 * written once instead of reimplemented per feature.
 *
 * Responsibility: run a schema, return typed data on success, throw a
 * ValidationError with full field details on failure. Nothing else.
 *
 * Dependencies: zod (type-only), errors.ts.
 * Future usage: every route handler and server action calls
 * `validate(someSchema, input)` as its first line.
 */

export function validate<TSchema extends ZodSchema>(
  schema: TSchema,
  input: unknown,
): ReturnType<TSchema['parse']> {
  const result = schema.safeParse(input);

  if (!result.success) {
    const details: ErrorDetail[] = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      issue: issue.message,
    }));
    throw new ValidationError('One or more fields are invalid.', details);
  }

  return result.data;
}
