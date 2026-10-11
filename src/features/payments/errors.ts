import { NotFoundError, ConflictError, ValidationError } from '@/shared/lib/errors';

/**
 * Why this file exists: same reasoning as orders/errors.ts — every class
 * here extends a shared error class so `isAppError()` and the payments
 * api-handler format these correctly with zero extra wiring.
 *
 * Note the deliberate absence of a "PaymentAlreadyPaidError" for the
 * confirm path: confirming an already-PAID bill is an idempotent no-op
 * success (see payment.service.impl.ts), not an error — only CANCELLING
 * a paid bill is a conflict.
 *
 * Dependencies: shared/lib/errors.ts (read-only).
 * Future usage: payment.service.impl.ts.
 */

export class PaymentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Payment', id);
  }
}

export class PaymentBillNotFoundError extends NotFoundError {
  constructor(billNo: string) {
    super('Payment bill', billNo);
  }
}

export class NoPendingPaymentError extends NotFoundError {
  constructor(customerPhone: string) {
    super('Pending payment for customer', customerPhone);
  }
}

export class PaymentAlreadyCancelledError extends ConflictError {
  constructor(billNo: string) {
    super(`Bill ${billNo} is already CANCELLED and cannot be marked as paid.`);
  }
}

export class PaymentAlreadyPaidError extends ConflictError {
  constructor(billNo: string) {
    super(`Bill ${billNo} is already PAID and cannot be cancelled.`);
  }
}

export class InvalidCustomerPhoneError extends ValidationError {
  constructor() {
    super('Customer phone number is invalid.', [
      { field: 'customerPhone', issue: 'Must be 10-15 digits, country code first, no + or spaces.' },
    ]);
  }
}
