import { db } from '@/shared/lib/db';
import type { OrderStatus, Prisma, CancellationReason } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { IOrderRepository } from '@/features/orders/repositories/order.repository';
import type { OrderWithDetails, CursorPage } from '@/features/orders/types';
import type { CreateOrderInput } from '@/features/orders/validation/order.validation';
import { InsufficientStockError, VariantNotFoundError } from '@/features/catalog/errors';
import { OrderNotFoundError, InvalidOrderStatusTransitionError } from '@/features/orders/errors';

/**
 * Why this file exists: the concrete Order repository, and the ONLY place
 * that touches Inventory.quantityOnHand for order-driven stock changes —
 * same single-write-path discipline as PrismaInventoryRepository
 * (see catalog/repositories/inventory.repository.impl.ts). It does that by
 * reusing InventoryTransaction as the ledger (type SALE on order creation,
 * type RETURN on cancellation) rather than inventing a parallel stock
 * mechanism specific to orders — one ledger, one source of truth for
 * "why did this variant's stock change," whether the change came from a
 * manual stock-in or an order.
 *
 * Both `createWithItems` and `updateStatus`(...CANCELLED) run entirely
 * inside one `db.$transaction`: an Order row, its OrderItems, and every
 * InventoryTransaction/Inventory update it implies either all commit
 * together or none do. A crash mid-checkout can never leave stock
 * deducted with no matching order, or an order placed with stock
 * untouched.
 *
 * Dependencies: db.ts, order.repository.ts (interface), orders/types.ts,
 * order.validation.ts, catalog/errors.ts (VariantNotFoundError,
 * InsufficientStockError — reused rather than re-declared, since "the
 * variant doesn't exist" and "not enough stock" are the same failures
 * catalog already named).
 * Future usage: constructed by order.service.impl.ts.
 */

const ORDER_INCLUDE = {
  items: true,
  statusHistory: { orderBy: { createdAt: 'asc' } },
  customer: true,
} satisfies Prisma.OrderInclude;

/** Status transitions allowed from each current status. Terminal states (COMPLETED, CANCELLED) allow none. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export class PrismaOrderRepository implements IOrderRepository {
  async findById(id: string): Promise<OrderWithDetails | null> {
    return db.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  }

  async findMany(filters: {
    status?: OrderStatus;
    customerId?: string;
    cursor?: string;
    limit: number;
  }): Promise<CursorPage<OrderWithDetails>> {
    const rows = await db.order.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: filters.limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > filters.limit;
    const data = (hasMore ? rows.slice(0, filters.limit) : rows) as OrderWithDetails[];
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore };
  }

  async createWithItems(input: CreateOrderInput, orderNumber: string): Promise<OrderWithDetails> {
    const orderId = await db.$transaction(async (tx) => {
      let subtotal = new Decimal(0);
      const itemRows: Array<{
        variantId: string;
        productNameSnapshot: string;
        skuSnapshot: string | null;
        unitPrice: Decimal;
        quantity: number;
        lineTotal: Decimal;
      }> = [];

      // Pass 1: validate every line and lock in price/stock BEFORE writing
      // anything, so a bad line (unknown variant, insufficient stock)
      // fails the whole order instead of leaving earlier lines committed.
      for (const line of input.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          include: { product: true, inventory: true },
        });
        if (!variant || variant.deletedAt) {
          throw new VariantNotFoundError(line.variantId);
        }

        const available = variant.inventory?.quantityOnHand ?? 0;
        if (available < line.quantity) {
          throw new InsufficientStockError(line.variantId, line.quantity, available);
        }

        const lineTotal = variant.price.mul(line.quantity);
        subtotal = subtotal.add(lineTotal);
        itemRows.push({
          variantId: variant.id,
          productNameSnapshot: variant.product.name,
          skuSnapshot: variant.sku,
          unitPrice: variant.price,
          quantity: line.quantity,
          lineTotal,
        });
      }

      const discount = new Decimal(input.discount ?? 0);
      const total = subtotal.sub(discount);

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: input.customerId ?? null,
          guestName: input.guestName ?? null,
          guestPhone: input.guestPhone ?? null,
          guestAddress: input.guestAddress ?? null,
          status: 'PENDING',
          source: input.source,
          fulfillmentType: input.fulfillmentType,
          deliveryAddressId: input.deliveryAddressId ?? null,
          subtotal,
          discount,
          total,
          items: { create: itemRows },
          statusHistory: {
            create: { status: 'PENDING', changedByUserId: null, note: 'Order placed.' },
          },
        },
      });

      // Pass 2: deduct stock for every line, via the same InventoryTransaction
      // ledger inventory.repository.impl.ts uses — a SALE transaction
      // referencing this order, so stock history and order history agree.
      for (const line of input.items) {
        const inventory = await tx.inventory.findUniqueOrThrow({ where: { variantId: line.variantId } });
        await tx.inventory.update({
          where: { variantId: line.variantId },
          data: { quantityOnHand: inventory.quantityOnHand - line.quantity },
        });
        await tx.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            type: 'SALE',
            quantity: -line.quantity,
            note: `Order ${orderNumber}`,
            referenceType: 'ORDER',
            referenceId: order.id,
            performedByUserId: null,
          },
        });
      }

      return order.id;
    });

    return (await this.findById(orderId))!;
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    changedByUserId: string | null,
    note: string | null,
    cancellationReason?: CancellationReason,
  ): Promise<OrderWithDetails> {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) {
        throw new OrderNotFoundError(id);
      }
      if (!ALLOWED_TRANSITIONS[order.status].includes(status)) {
        throw new InvalidOrderStatusTransitionError(order.status, status);
      }

      await tx.order.update({
        where: { id },
        data: {
          status,
          ...(status === 'CANCELLED' ? { cancellationReason: cancellationReason ?? 'OTHER' } : {}),
        },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status, changedByUserId, note },
      });

      // Cancelling restocks every line — one RETURN transaction per item,
      // same ledger as everywhere else stock moves. Never touched for any
      // other transition (CONFIRMED, COMPLETED don't change stock — the
      // deduction already happened at order creation).
      if (status === 'CANCELLED') {
        for (const item of order.items) {
          const inventory = await tx.inventory.findUniqueOrThrow({ where: { variantId: item.variantId } });
          await tx.inventory.update({
            where: { variantId: item.variantId },
            data: { quantityOnHand: inventory.quantityOnHand + item.quantity },
          });
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              type: 'RETURN',
              quantity: item.quantity,
              note: `Order ${order.orderNumber} cancelled`,
              referenceType: 'ORDER',
              referenceId: order.id,
              performedByUserId: changedByUserId,
            },
          });
        }
      }
    });

    return (await this.findById(id))!;
  }

  async countNoShows(identity: { customerId?: string; guestPhone?: string }): Promise<number> {
    if (!identity.customerId && !identity.guestPhone) {
      return 0;
    }
    return db.order.count({
      where: {
        status: 'CANCELLED',
        cancellationReason: 'NO_SHOW',
        OR: [
          identity.customerId ? { customerId: identity.customerId } : undefined,
          identity.guestPhone ? { guestPhone: identity.guestPhone } : undefined,
        ].filter((clause): clause is NonNullable<typeof clause> => clause !== undefined),
      },
    });
  }
}
