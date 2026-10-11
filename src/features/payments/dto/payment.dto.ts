import type { Payment } from '@prisma/client';

/**
 * Why this file exists: payment response shapes, same reasoning as
 * orders/dto/order.dto.ts — the integer-paisa storage unit is converted
 * to human rupees here (the one boundary conversion point) so nothing
 * downstream of the API layer ever has to know the database stores
 * minor units.
 *
 * Dependencies: @prisma/client (types only).
 * Future usage: the payments API routes map service results through
 * toPaymentDto before returning them.
 */

export interface PaymentResponseDto {
  id: string;
  billNo: string;
  orderId: string | null;
  description: string | null;
  /** Amount in whole rupees (converted from stored paisa). */
  amountRupees: number;
  currency: string;
  method: string;
  status: string;
  customerPhone: string;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * PNG data URL of the bill's QR image. Populated on the create
   * response (so the caller can forward it immediately); null on plain
   * status reads, which don't need to re-render the QR.
   */
  qrImageDataUrl: string | null;
}

export function toPaymentDto(payment: Payment, qrImageDataUrl: string | null = null): PaymentResponseDto {
  return {
    id: payment.id,
    billNo: payment.billNo,
    orderId: payment.orderId,
    description: payment.description,
    amountRupees: payment.amountPaisa / 100,
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    customerPhone: payment.customerPhone,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    qrImageDataUrl,
  };
}
