import type { Payment, PaymentMethod } from '@prisma/client';
import type { PaymentRecord } from '@/features/payments/types';

/**
 * Why this file exists: the boundary the service layer depends on instead
 * of calling `db.payment.*` directly — same Repository Pattern rationale
 * as every other module's repository interface. A unit test can inject an
 * in-memory fake against this interface without touching Postgres.
 *
 * Dependencies: @prisma/client (types only), payments/types.ts.
 * Future usage: implemented by PrismaPaymentRepository
 * (payment.repository.impl.ts); depended on by PaymentService.
 */

export interface CreatePaymentData {
  billNo: string;
  orderId: string | null;
  amountPaisa: number;
  method: PaymentMethod;
  qrPayload: string;
  customerPhone: string;
  description: string | null;
  createdByUserId: string | null;
}

export interface IPaymentRepository {
  findById(id: string): Promise<PaymentRecord | null>;

  findByBillNo(billNo: string): Promise<PaymentRecord | null>;

  /** Newest PENDING bill for this customer phone — what confirm_payment resolves when the owner gives a phone number instead of a bill number. */
  findLatestPendingByPhone(customerPhone: string): Promise<PaymentRecord | null>;

  create(data: CreatePaymentData): Promise<PaymentRecord>;

  /** Sets status=PAID and stamps paidAt. The caller (service) owns the state-machine rules; this just writes. */
  markPaid(id: string, paidAt: Date): Promise<Payment>;

  /** Sets status=CANCELLED. The caller (service) owns the state-machine rules; this just writes. */
  markCancelled(id: string): Promise<Payment>;
}
