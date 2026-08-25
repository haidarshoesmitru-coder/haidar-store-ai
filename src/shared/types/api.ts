import type { ErrorCode, ErrorDetail } from '@/shared/lib/errors';

/**
 * Why this file exists: gives client code (and future route handlers) a
 * single, typed shape for every API response, matching §17 of the API
 * architecture exactly. Without this, every feature would invent its own
 * response shape and the client would need per-endpoint parsing logic.
 *
 * Dependencies: errors.ts (for the ErrorCode union — one source of truth
 * for what error codes exist, shared between the throwing side and the
 * typing side).
 * Future usage: every route handler's return type is
 * `ApiResponse<SomeDto>`; the future frontend API client types its fetch
 * wrappers against this.
 */

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    requestId: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}
