import type { OrderStatus, CancellationReason } from '@prisma/client';
import type { OrderWithDetails, CursorPage } from '@/features/orders/types';
import type { CreateOrderInput } from '@/features/orders/validation/order.validation';

/**
 * Why this file exists: the boundary the service layer depends on instead
 * of calling `db.order.*` directly — same Repository Pattern rationale as
 * base.repository.ts and every catalog repository interface. A unit test
 * can inject an in-memory fake against this interface without touching
 * Postgres.
 *
 * Dependencies: orders/types.ts, order.validation.ts (for CreateOrderInput).
 * Future usage: implemented by PrismaOrderRepository (order.repository.impl.ts);
 * depended on by IOrderService's implementation.
 */
export interface IOrderRepository {
  findById(id: string): Promise<OrderWithDetails | null>;

  findMany(filters: {
    status?: OrderStatus;
    customerId?: string;
    cursor?: string;
    limit: number;
  }): Promise<CursorPage<OrderWithDetails>>;

  /**
   * Creates the Order + OrderItem rows and decrements inventory for every
   * line, all inside one database transaction — an Order can never exist
   * without its stock having actually been deducted, or vice versa.
   * Line prices are read from the current ProductVariant and snapshotted
   * onto each OrderItem at creation time (see schema.prisma's OrderItem
   * comment).
   */
  createWithItems(input: CreateOrderInput, orderNumber: string): Promise<OrderWithDetails>;

  /**
   * Writes the new status, appends one OrderStatusHistory row, and — for
   * CANCELLED specifically — restocks every line's quantity back onto
   * Inventory, all inside one transaction. A cancelled order and its
   * inventory reversal either both happen or neither does.
   * `cancellationReason` is required by the caller (service layer) only
   * when status is CANCELLED; ignored otherwise.
   */
  updateStatus(
    id: string,
    status: OrderStatus,
    changedByUserId: string | null,
    note: string | null,
    cancellationReason?: CancellationReason,
  ): Promise<OrderWithDetails>;

  /**
   * Counts past orders cancelled with reason NO_SHOW for this identity —
   * matched by customerId when known, otherwise by guestPhone (a guest
   * who never registers is still trackable by the phone number they gave
   * at checkout). This is the sole input to the no-show protection policy
   * (OrderService.createOrder) — no separate counter is stored anywhere;
   * the count is always derived fresh from order history.
   */
  countNoShows(identity: { customerId?: string; guestPhone?: string }): Promise<number>;
}
