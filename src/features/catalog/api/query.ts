import type { NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import { validate } from '@/shared/validation/validate';
import { uuidSchema } from '@/features/catalog/validation/shared.schema';

/**
 * Why this file exists: two small, repeated pieces of route-handler
 * plumbing — turning `req.nextUrl.searchParams` into a plain object
 * Zod can validate, and validating a route param (`:id`) as a UUID.
 * Written once here instead of five times across the product/category/
 * brand/variant/inventory route files.
 *
 * Dependencies: shared/validation/validate.ts (Sprint 1, unchanged),
 * shared.schema.ts (Sprint 2.2, read-only import).
 * Future usage: every GET route with query params; every route with a
 * `:id`/`:variantId` param.
 */

export function parseSearchParams<TSchema extends ZodSchema>(req: NextRequest, schema: TSchema): ReturnType<TSchema['parse']> {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  return validate(schema, raw);
}

export function parseUuidParam(value: string): string {
  return validate(uuidSchema, value);
}
