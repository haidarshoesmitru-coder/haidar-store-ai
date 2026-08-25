import type { OrderStatus, CancellationReason } from '@prisma/client';
import type { IOrderService } from '@/features/orders/services/order.service';
import { PrismaOrderRepository } from '@/features/orders/repositories/order.repository.impl';
import type { IOrderRepository } from '@/features/orders/repositories/order.repository';
import type { OrderWithDetails, CursorPage } from '@/features/orders/types';
import { NO_SHOW_BLOCK_THRESHOLD, type CreateOrderInput, type ListOrdersQuery } from '@/features/orders/validation/order.validation';
import {
  OrderNotFoundError,
  DeliveryNotYetSupportedError,
  MissingGuestContactError,
  CustomerBlockedForNoShowError,
} from '@/features/orders/errors';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: business rules that must hold BEFORE the
 * repository's transaction ever starts. Three rules live here specifically
 * because they're policy, not data integrity, and policy is expected to
 * change independently of the schema:
 *   1. DeliveryNotYetSupportedError — the schema already models delivery
 *      (see schema.prisma's Orders module comment); this is the one line
 *      that will be deleted when delivery actually ships, with no schema
 *      change needed alongside it.
 *   2. No-show protection — NO_SHOW_BLOCK_THRESHOLD (currently 3) past
 *      NO_SHOW-cancelled orders for this customer/guest phone blocks a
 *      new order with a clear reason. Checked here, not in the
 *      repository, because "how many strikes" and "what happens on the
 *      Nth strike" are exactly the kind of rule a shop owner might want
 *      to tune later (e.g. a WhatsApp warning on strike 2) without
 *      touching the transactional write path at all.
 *   3. Order numbers are generated here (`ORD-YYYYMMDD-XXXX`), not left
 *      to the database, since the format is a business decision.
 *
 * Dependencies: order.repository.impl.ts, orders/errors.ts, logger.ts.
 * Future usage: constructed by Sprint 3.1's order API routes; the
 * WhatsApp AI chatbot (next phase) calls createOrder directly, so this is
 * also where the AI's "you're on hold" reply gets its answer from.
 */
export class OrderService implements IOrderService {
  constructor(private readonly orderRepository: IOrderRepository = new PrismaOrderRepository()) {}

  async getById(id: string): Promise<OrderWithDetails | null> {
    return this.orderRepository.findById(id);
  }

  async list(query: ListOrdersQuery): Promise<CursorPage<OrderWithDetails>> {
    return this.orderRepository.findMany({
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit,
    });
  }

  async createOrder(input: CreateOrderInput): Promise<OrderWithDetails> {
    if (input.fulfillmentType === 'DELIVERY') {
      throw new DeliveryNotYetSupportedError();
    }
    if (!input.customerId && !input.guestName && !input.guestPhone) {
      throw new MissingGuestContactError();
    }

    const noShowCount = await this.getNoShowCount({
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.guestPhone ? { guestPhone: input.guestPhone } : {}),
    });
    if (noShowCount >= NO_SHOW_BLOCK_THRESHOLD) {
      logger.warn('Order blocked: repeat no-show', {
        customerId: input.customerId,
        guestPhone: input.guestPhone,
        noShowCount,
      });
      throw new CustomerBlockedForNoShowError(noShowCount, NO_SHOW_BLOCK_THRESHOLD);
    }

    const orderNumber = generateOrderNumber();
    const order = await this.orderRepository.createWithItems(input, orderNumber);

    logger.info('Order created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      source: order.source,
      itemCount: order.items.length,
    });

    return order;
  }

  async confirmOrder(id: string, changedByUserId?: string, note?: string): Promise<OrderWithDetails> {
    return this.updateStatus(id, 'CONFIRMED', changedByUserId, note);
  }

  async completeOrder(id: string, changedByUserId?: string, note?: string): Promise<OrderWithDetails> {
    return this.updateStatus(id, 'COMPLETED', changedByUserId, note);
  }

  async cancelOrder(
    id: string,
    reason: CancellationReason,
    changedByUserId?: string,
    note?: string,
  ): Promise<OrderWithDetails> {
    return this.updateStatus(id, 'CANCELLED', changedByUserId, note, reason);
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    changedByUserId?: string,
    note?: string,
    cancellationReason?: CancellationReason,
  ): Promise<OrderWithDetails> {
    const existing = await this.orderRepository.findById(id);
    if (!existing) {
      throw new OrderNotFoundError(id);
    }

    const order = await this.orderRepository.updateStatus(
      id,
      status,
      changedByUserId ?? null,
      note ?? null,
      cancellationReason,
    );

    logger.info('Order status changed', { orderId: id, from: existing.status, to: status, cancellationReason });

    return order;
  }

  async getNoShowCount(identity: { customerId?: string; guestPhone?: string }): Promise<number> {
    return this.orderRepository.countNoShows(identity);
  }
}

/**
 * `ORD-YYYYMMDD-XXXX` — date-scoped so staff can eyeball roughly when an
 * order was placed from the number alone, plus a random 4-digit suffix.
 * Collision odds within one day (1 in 10,000, re-rolled by a unique
 * constraint retry at the DB layer) are acceptable for a single-location
 * shop's order volume; a sequence-based scheme is a drop-in replacement
 * if that ever stops being true.
 */
function generateOrderNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ORD-${datePart}-${suffix}`;
}
