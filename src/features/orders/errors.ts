import { NotFoundError, ConflictError, ValidationError } from '@/shared/lib/errors';

/**
 * Why this file exists: same reasoning as catalog/errors.ts — every class
 * here extends a Sprint 1 error class instead of replacing it, so
 * `isAppError()` and both api-handler.ts files (untouched) recognize and
 * format these correctly with zero changes to either.
 *
 * Dependencies: shared/lib/errors.ts (read-only).
 * Future usage: order.service.impl.ts; caught nowhere else, since
 * api-handler.ts already formats any AppError subtype correctly.
 */

export class OrderNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Order', id);
  }
}

export class EmptyOrderError extends ValidationError {
  constructor() {
    super('An order must contain at least one item.', [
      { field: 'items', issue: 'At least one item is required.' },
    ]);
  }
}

export class InvalidOrderStatusTransitionError extends ConflictError {
  constructor(from: string, to: string) {
    super(`Cannot move an order from "${from}" to "${to}".`);
  }
}

/**
 * Thrown when fulfillmentType is DELIVERY. Delivery is modeled in the
 * schema (Order.fulfillmentType, CustomerAddress) but there is no
 * delivery business logic yet — no shipping cost, no rider assignment,
 * no address validation. Rejecting explicitly here (rather than silently
 * treating DELIVERY as PICKUP) keeps the gap honest until that logic is
 * actually built, instead of quietly mishandling a real delivery order.
 */
export class DeliveryNotYetSupportedError extends ValidationError {
  constructor() {
    super('Delivery is not available yet — pickup only for now.', [
      { field: 'fulfillmentType', issue: 'Only PICKUP is currently supported.' },
    ]);
  }
}

export class MissingGuestContactError extends ValidationError {
  constructor() {
    super('A guest order needs at least a name or phone number.', [
      { field: 'guestName', issue: 'Provide guestName and/or guestPhone when no customerId is given.' },
    ]);
  }
}

/**
 * Thrown when a customer/guest phone has NO_SHOW-cancelled `threshold` or
 * more past orders. `pastNoShowCount` is carried on the error so the
 * WhatsApp AI (or admin UI) can phrase its own message rather than every
 * caller re-deriving the count from the generic message string.
 */
export class CustomerBlockedForNoShowError extends ConflictError {
  constructor(
    public readonly pastNoShowCount: number,
    public readonly threshold: number,
  ) {
    super(
      `You've placed ${pastNoShowCount} order(s) before and did not pick them up. ` +
        `New orders are on hold — please contact the shop directly to place this order.`,
    );
  }
}
