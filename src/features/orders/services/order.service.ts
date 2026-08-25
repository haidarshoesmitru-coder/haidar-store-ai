import type { OrderStatus, CancellationReason } from '@prisma/client';
import type { OrderWithDetails, CursorPage } from '@/features/orders/types';
import type { CreateOrderInput, ListOrdersQuery } from '@/features/orders/validation/order.validation';

/**
 * Why this file exists: the business-rule layer over IOrderRepository's
 * transactional write paths (createWithItems, updateStatus) — same
 * separation as InventoryService sits over IInventoryRepository. The
 * repository will insert whatever it's given inside its transaction;
 * this is where "delivery isn't live yet," "guest orders need a name or
 * phone," and "block repeat no-shows" actually get enforced, before the
 * repository is ever called.
 *
 * Dependencies: orders/types.ts, order.validation.ts.
 * Future usage: constructed by Sprint 3.1's order API routes; later, the
 * WhatsApp AI service calls createOrder/getOrderStatus on the customer's
 * behalf — createOrder's no-show check is exactly what lets the AI itself
 * say "you're on hold" without any separate lookup.
 */
export interface IOrderService {
  getById(id: string): Promise<OrderWithDetails | null>;

  list(query: ListOrdersQuery): Promise<CursorPage<OrderWithDetails>>;

  /**
   * Validates the request (fulfillment type, guest identity, no-show
   * block), generates the order number, then delegates to the
   * repository's one transactional write path. Rejects
   * (CustomerBlockedForNoShowError) if this customer/guest phone has
   * NO_SHOW_BLOCK_THRESHOLD or more past NO_SHOW-cancelled orders.
   */
  createOrder(input: CreateOrderInput): Promise<OrderWithDetails>;

  /** PENDING -> CONFIRMED. Rejects if the order isn't currently PENDING. */
  confirmOrder(id: string, changedByUserId?: string, note?: string): Promise<OrderWithDetails>;

  /** CONFIRMED -> COMPLETED. Rejects if the order isn't currently CONFIRMED. */
  completeOrder(id: string, changedByUserId?: string, note?: string): Promise<OrderWithDetails>;

  /**
   * PENDING or CONFIRMED -> CANCELLED. Restocks every line back onto
   * Inventory. `reason` is required — NO_SHOW is what the block policy
   * counts, so misreporting it either wrongly blocks or wrongly clears a
   * genuine repeat no-show customer.
   */
  cancelOrder(
    id: string,
    reason: CancellationReason,
    changedByUserId?: string,
    note?: string,
  ): Promise<OrderWithDetails>;

  updateStatus(
    id: string,
    status: OrderStatus,
    changedByUserId?: string,
    note?: string,
    cancellationReason?: CancellationReason,
  ): Promise<OrderWithDetails>;

  /** How many NO_SHOW-cancelled orders this identity has — exposed so a route/admin UI can show it without re-deriving the block decision. */
  getNoShowCount(identity: { customerId?: string; guestPhone?: string }): Promise<number>;
}
