import type { ErrorCode, ErrorDetail } from '@/shared/lib/errors';

/**
 * Why this file exists: this sprint's spec asks for a specific response
 * envelope — `{ success, message, data, meta }` on success and
 * `{ success, error, code, details }` on failure — which is a DIFFERENT
 * shape from Sprint 1's existing `{ data }` / `{ error: { code, message,
 * details, requestId } }` envelope in shared/lib/api-response.ts. Editing
 * that file was out of scope ("do not modify previous sprints"), and
 * Sprint 1's shape is still correct for whatever else builds on
 * `createApiHandler` later. This file is the Catalog module's OWN
 * response formatter, used only by catalog.ts (below) — additive, not a
 * replacement.
 *
 * Dependencies: shared/lib/errors.ts (types only, for ErrorCode/ErrorDetail
 * — reusing Sprint 1's closed error-code set rather than inventing a
 * second one).
 * Future usage: exclusively by createCatalogRoute in handler.ts. No route
 * file constructs these directly.
 */

export interface CatalogSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}

export interface CatalogErrorBody {
  success: false;
  error: string;
  code: ErrorCode;
  details: ErrorDetail[] | null;
}

export function successBody<T>(data: T, message: string, meta: Record<string, unknown> | null = null): CatalogSuccessBody<T> {
  return { success: true, message, data, meta };
}

export function errorBody(error: { code: ErrorCode; message: string; details?: ErrorDetail[] | undefined }): CatalogErrorBody {
  return {
    success: false,
    error: error.message,
    code: error.code,
    details: error.details ?? null,
  };
}
