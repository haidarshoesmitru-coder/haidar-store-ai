import type { Order, OrderItem, OrderStatusHistory, Customer } from '@prisma/client';

/**
 * Why this file exists: mirrors catalog/types.ts's role for this module —
 * the shared "with relations loaded" shapes both the repository and
 * service layer need, defined once instead of an inline Prisma `include`
 * type repeated at every call site.
 *
 * Dependencies: @prisma/client (types only).
 * Future usage: order.repository.ts / .impl.ts, order.service.ts / .impl.ts,
 * order.dto.ts's mapper functions.
 */

export type OrderWithDetails = Order & {
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  customer: Customer | null;
};

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
