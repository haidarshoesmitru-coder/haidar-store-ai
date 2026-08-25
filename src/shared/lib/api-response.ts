import type { ApiErrorBody, ApiSuccess } from '@/shared/types/api';
import type { KnownAppError } from '@/shared/lib/errors';

/** Dependencies: api.ts types, errors.ts. Used exclusively by api-handler.ts. */

export function successBody<T>(data: T): ApiSuccess<T> {
  return { data };
}

export function errorBody(error: KnownAppError, requestId: string): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      requestId,
    },
  };
}
