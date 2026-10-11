import type { ErrorCode, ErrorDetail } from '@/shared/lib/errors';

/**
 * Why this file exists: same reasoning as orders/api/response.ts — each
 * feature module owns its response envelope rather than every module
 * fighting over one shared shape. Payments reuses the exact same
 * `{ success, message, data, meta }` / `{ success, error, code, details }`
 * envelope the other modules established, so a client integrating against
 * several modules sees one consistent contract — this file just gives
 * Payments its own copy, keeping the module boundary clean.
 *
 * Dependencies: shared/lib/errors.ts (types only).
 * Future usage: exclusively by createPaymentRoute in handler.ts.
 */

export interface PaymentSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}

export interface PaymentErrorBody {
  success: false;
  error: string;
  code: ErrorCode;
  details: ErrorDetail[] | null;
}

export function successBody<T>(data: T, message: string, meta: Record<string, unknown> | null = null): PaymentSuccessBody<T> {
  return { success: true, message, data, meta };
}

export function errorBody(error: { code: ErrorCode; message: string; details?: ErrorDetail[] | undefined }): PaymentErrorBody {
  return {
    success: false,
    error: error.message,
    code: error.code,
    details: error.details ?? null,
  };
}
