import type { ErrorCode, ErrorDetail } from '@/shared/lib/errors';

/**
 * Why this file exists: same reasoning as catalog/api/response.ts — each
 * feature module owns its response envelope rather than every module
 * fighting over one shared shape. Orders reuses the exact same
 * `{ success, message, data, meta }` / `{ success, error, code, details }`
 * envelope catalog already established, so a client integrating against
 * both modules sees one consistent contract — this file just gives Orders
 * its own copy rather than importing catalog's, keeping the module
 * boundary clean (orders never imports from catalog's api/ folder).
 *
 * Dependencies: shared/lib/errors.ts (types only).
 * Future usage: exclusively by createOrderRoute in handler.ts.
 */

export interface OrderSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}

export interface OrderErrorBody {
  success: false;
  error: string;
  code: ErrorCode;
  details: ErrorDetail[] | null;
}

export function successBody<T>(data: T, message: string, meta: Record<string, unknown> | null = null): OrderSuccessBody<T> {
  return { success: true, message, data, meta };
}

export function errorBody(error: { code: ErrorCode; message: string; details?: ErrorDetail[] | undefined }): OrderErrorBody {
  return {
    success: false,
    error: error.message,
    code: error.code,
    details: error.details ?? null,
  };
}
