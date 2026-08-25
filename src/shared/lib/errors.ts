/**
 * Why this file exists:
 * The API architecture doc fixed a specific error envelope (code, message,
 * details, requestId) and a specific set of HTTP status mappings. This file
 * is what makes that a guarantee instead of a convention every route
 * handler has to remember to follow. Services throw one of these classes;
 * api-handler.ts (below) is the ONLY place that catches them and turns them
 * into the HTTP response — a service never constructs an HTTP response
 * itself, which is what keeps business logic testable without a request/
 * response mock.
 *
 * Responsibility: define the closed set of error types the app can throw
 * intentionally, each carrying the info needed to render the standard
 * envelope. Nothing here talks HTTP directly.
 *
 * Dependencies: none.
 * Future usage: every feature module's service layer throws these instead
 * of generic `Error` or ad hoc objects — e.g. the future Orders service
 * throws `new ConflictError(...)` when a status transition is illegal.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  field: string;
  issue: string;
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Base class. Not exported for direct use — always throw one of the named
 * subclasses below, so a `catch` block reading error types stays
 * meaningful (`instanceof NotFoundError`, not `instanceof AppError` with a
 * code check buried inside).
 */
abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  readonly details: ErrorDetail[] | undefined;

  protected constructor(message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }

  get httpStatus(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR' as const;
  constructor(message: string, details: ErrorDetail[]) {
    super(message, details);
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
  }
}

export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message = 'Authentication required.') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN' as const;
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT' as const;
  constructor(message: string) {
    super(message);
  }
}

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMITED' as const;
  constructor(message = 'Too many requests. Please try again shortly.') {
    super(message);
  }
}

export class InternalError extends AppError {
  readonly code = 'INTERNAL_ERROR' as const;
  constructor(message = 'Something went wrong on our end.') {
    super(message);
  }
}

export type KnownAppError =
  | ValidationError
  | NotFoundError
  | UnauthorizedError
  | ForbiddenError
  | ConflictError
  | RateLimitError
  | InternalError;

export function isAppError(error: unknown): error is KnownAppError {
  return (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError ||
    error instanceof ConflictError ||
    error instanceof RateLimitError ||
    error instanceof InternalError
  );
}
