import { z } from 'zod';

/**
 * Why this file exists: `createOrderSchema` is the one input shape behind
 * every order origin (website checkout today, WhatsApp AI and admin-created
 * orders later) — the `source` field says which, per OrderSource. Only
 * `PICKUP` is accepted for `fulfillmentType` right now; DELIVERY is a
 * valid enum value at the schema layer (matches the DB) but is rejected
 * by the service layer with a clear error (DeliveryNotYetSupportedError)
 * rather than the request schema silently disallowing a value the
 * database already understands.
 *
 * A request supplies EITHER `customerId` (existing customer) OR guest
 * fields (`guestName`/`guestPhone`) — never neither. That "at least one
 * identity" rule is a cross-field check, so it's a `.refine()` here
 * rather than something a single field's type could express.
 *
 * Dependencies: zod.
 * Future usage: order.service.impl.ts, Sprint 3.1's order API routes.
 */

const orderItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    guestName: z.string().min(1).max(150).optional(),
    guestPhone: z.string().min(1).max(30).optional(),
    guestAddress: z.string().max(500).optional(),
    source: z.enum(['WEBSITE', 'WHATSAPP', 'ADMIN']),
    fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
    deliveryAddressId: z.string().uuid().optional(),
    items: z.array(orderItemInputSchema).min(1, 'An order must contain at least one item.'),
    discount: z.number().nonnegative().default(0),
    note: z.string().max(500).optional(),
  })
  .refine((data) => data.customerId || data.guestName || data.guestPhone, {
    message: 'Provide customerId, or a guest name/phone.',
    path: ['customerId'],
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  note: z.string().max(500).optional(),
  changedByUserId: z.string().uuid().optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Cancelling requires a reason (unlike confirm/complete, which don't).
 * NO_SHOW specifically is what the no-show protection policy counts —
 * getting this wrong (e.g. defaulting every cancellation to NO_SHOW)
 * would incorrectly block customers who cancelled for an ordinary reason,
 * so it's a required field here rather than an optional one defaulting
 * to something.
 */
export const cancelOrderSchema = z.object({
  reason: z.enum(['CUSTOMER_REQUEST', 'NO_SHOW', 'OUT_OF_STOCK', 'STAFF_ERROR', 'OTHER']),
  note: z.string().max(500).optional(),
  changedByUserId: z.string().uuid().optional(),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/** Past NO_SHOW-cancelled orders at or above this count blocks new orders. Business policy, not schema — safe to tune without a migration. */
export const NO_SHOW_BLOCK_THRESHOLD = 3;

export const listOrdersQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  customerId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
