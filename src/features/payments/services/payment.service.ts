import type { PaymentRecord } from '@/features/payments/types';
import type { CreatePaymentInput } from '@/features/payments/validation/payment.validation';

/**
 * Why this file exists: the business-rule layer over IPaymentRepository's
 * write paths — same separation as OrderService over IOrderRepository.
 * The repository will write whatever it's given; this is where the bill
 * lifecycle rules actually get enforced before the repository is called:
 *
 *   - Bills are numbered BILL-YYYYMMDD-XXXX (a business format decision,
 *     mirroring Order's ORD- numbers, kept here not in the DB).
 *   - createPayment always goes through the PaymentProvider, so the QR
 *     and the stored qrPayload can never disagree.
 *   - confirmPayment is IDEMPOTENT: confirming an already-PAID bill is a
 *     no-op success, not an error — safe for double-taps and for the
 *     future auto-confirm webhook retrying delivery.
 *   - PAID and CANCELLED are terminal: a PAID bill can't be cancelled,
 *     a CANCELLED bill can't be marked paid.
 *
 * Dependencies: payments/types.ts, payment.validation.ts.
 * Future usage: constructed by the payments API routes and by the
 * WhatsApp AI's create_bill_qr / confirm_payment owner tools.
 */
export interface IPaymentService {
  /**
   * Creates the bill, generates its QR via the provider, and returns both
   * the stored payment and the QR's PNG data URL (for immediate sending).
   * `createdByUserId` is the staff User id for API-created bills, null for
   * WhatsApp-owner-created bills (attributed via the isOwner check).
   */
  createPayment(
    input: CreatePaymentInput,
    createdByUserId: string | null,
  ): Promise<{ payment: PaymentRecord; qrImageDataUrl: string }>;

  getById(id: string): Promise<PaymentRecord>;

  getByBillNo(billNo: string): Promise<PaymentRecord>;

  /**
   * PENDING -> PAID. Idempotent: already-PAID returns the payment
   * unchanged. Throws PaymentNotFoundError / PaymentAlreadyCancelledError.
   */
  confirmPayment(id: string, note?: string): Promise<PaymentRecord>;

  /** Same as confirmPayment, looked up by bill number. */
  confirmPaymentByBillNo(billNo: string, note?: string): Promise<PaymentRecord>;

  /** Confirms the customer's newest PENDING bill — what the owner means by "Ali ke paise aa gaye". */
  confirmLatestPendingForPhone(customerPhone: string, note?: string): Promise<PaymentRecord>;

  /**
   * PENDING -> CANCELLED. Idempotent on already-CANCELLED. A PAID bill
   * can never be cancelled (PaymentAlreadyPaidError).
   */
  cancelPayment(id: string): Promise<PaymentRecord>;
}
