import type { OrderWithDetails } from '@/features/orders/types';

/**
 * Why this file exists: order response shapes, same reasoning as
 * catalog/dto/inventory.dto.ts — Decimal fields are converted to plain
 * numbers here (the one boundary conversion point) so nothing downstream
 * of the API layer (route handlers, eventually the WhatsApp AI's replies)
 * has to know Prisma's Decimal type exists.
 *
 * Dependencies: orders/types.ts.
 * Future usage: order.service.impl.ts's return values are mapped through
 * this at the API route layer.
 */

export interface OrderItemResponseDto {
  id: string;
  variantId: string;
  productName: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusHistoryResponseDto {
  status: string;
  note: string | null;
  createdAt: Date;
}

export interface OrderResponseDto {
  id: string;
  orderNumber: string;
  status: string;
  source: string;
  fulfillmentType: string;
  customerId: string | null;
  customerName: string | null;
  guestName: string | null;
  guestPhone: string | null;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  items: OrderItemResponseDto[];
  statusHistory: OrderStatusHistoryResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export function toOrderDto(order: OrderWithDetails): OrderResponseDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    source: order.source,
    fulfillmentType: order.fulfillmentType,
    customerId: order.customerId,
    customerName: order.customer?.name ?? null,
    guestName: order.guestName,
    guestPhone: order.guestPhone,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    total: Number(order.total),
    currency: order.currency,
    items: order.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productName: item.productNameSnapshot,
      sku: item.skuSnapshot,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
    })),
    statusHistory: order.statusHistory.map((h) => ({
      status: h.status,
      note: h.note,
      createdAt: h.createdAt,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
