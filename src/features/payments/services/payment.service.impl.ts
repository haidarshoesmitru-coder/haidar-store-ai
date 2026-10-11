import type { IPaymentService } from '@/features/payments/services/payment.service';
import { PrismaPaymentRepository } from '@/features/payments/repositories/payment.repository.impl';
import type { IPaymentRepository } from '@/features/payments/repositories/payment.repository';
import type { PaymentRecord } from '@/features/payments/types';
import type { PaymentMethod } from '@prisma/client';
import {
  type CreatePaymentInput,
  normalizePhoneNumber,
} from '@/features/payments/validation/payment.validation';
import {
  type PaymentProvider,
  StaticQrProvider,
} from '@/features/payments/providers/payment-provider';
import {
  PaymentNotFoundError,
  PaymentBillNotFoundError,
  NoPendingPaymentError,
  PaymentAlreadyCancelledError,
  PaymentAlreadyPaidError,
  InvalidCustomerPhoneError,
} from '@/features/payments/errors';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: the bill lifecycle rules named in
 * payment.service.ts, enforced before any repository write. Two things
 * are deliberately kept here rather than in the repository:
 *
 *   1. Bill numbering (BILL-YYYYMMDD-XXXX) — a business format decision,
 *      same as Order's generateOrderNumber. Collisions are theoretically
 *      possible on the random suffix, so creation retries a few times
 *      rather than surfacing a raw unique-constraint 500 (cf. the audit
 *      note on Order's missing retry).
 *   2. The provider seam — `new StaticQrProvider()` is only the DEFAULT.
 *      Injecting a JazzCashBusinessProvider later changes one constructor
 *      argument; every rule below keeps working because none of them
 *      know which provider rendered the QR.
 *
 * Privacy note: logs carry billNo/amount/status only — never the
 * customer's phone number or the shop's JazzCash number (audit: no PII
 * in logs).
 *
 * Dependencies: payment.repository.impl.ts, payment-provider.ts,
 * payments/errors.ts, logger.ts.
 * Future usage: payments API routes; ai/owner-tools.ts (create_bill_qr,
 * confirm_payment).
 */

const BILL_NUMBER_RETRIES = 3;

export class PaymentService implements IPaymentService {
  constructor(
    private readonly paymentRepository: IPaymentRepository = new PrismaPaymentRepository(),
    private readonly provider: PaymentProvider = new StaticQrProvider(),
  ) {}

  async createPayment(
    input: CreatePaymentInput,
    createdByUserId: string | null,
  ): Promise<{ payment: PaymentRecord; qrImageDataUrl: string }> {
    const amountPaisa = input.amountRupees * 100;
    const customerPhone = this.requireValidPhone(input.customerPhone);

    // Bill-number collision retry (same class of issue the audit flagged
    // on Order numbers): on the rare unique-constraint hit, regenerate
    // and try again instead of failing the bill.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < BILL_NUMBER_RETRIES; attempt++) {
      const billNo = generateBillNo();
      try {
        const qr = await this.provider.generateQr({
          amountPaisa,
          billNo,
          description: input.description ?? null,
        });
        const payment = await this.paymentRepository.create({
          billNo,
          orderId: input.orderId ?? null,
          amountPaisa,
          method: this.provider.method as PaymentMethod,
          qrPayload: qr.payload,
          customerPhone,
          description: input.description ?? null,
          createdByUserId,
        });

        logger.info('Payment bill created', {
          paymentId: payment.id,
          billNo,
          amountPaisa,
          method: payment.method,
        });

        return { payment, qrImageDataUrl: qr.imageDataUrl };
      } catch (error) {
        lastError = error;
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        logger.warn('Bill number collision, retrying', { billNo, attempt: attempt + 1 });
      }
    }
    throw lastError;
  }

  async getById(id: string): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new PaymentNotFoundError(id);
    }
    return payment;
  }

  async getByBillNo(billNo: string): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findByBillNo(billNo);
    if (!payment) {
      throw new PaymentBillNotFoundError(billNo);
    }
    return payment;
  }

  async confirmPayment(id: string, note?: string): Promise<PaymentRecord> {
    const existing = await this.getById(id);

    // Idempotent: confirming twice (double-tap, webhook retry) is a
    // no-op success, not an error.
    if (existing.status === 'PAID') {
      logger.info('Payment confirm idempotent no-op (already PAID)', {
        paymentId: id,
        billNo: existing.billNo,
      });
      return existing;
    }
    if (existing.status === 'CANCELLED') {
      throw new PaymentAlreadyCancelledError(existing.billNo);
    }

    const paid = await this.paymentRepository.markPaid(id, new Date());
    logger.info('Payment confirmed', {
      paymentId: id,
      billNo: paid.billNo,
      amountPaisa: paid.amountPaisa,
      ...(note ? { note } : {}),
    });
    return paid;
  }

  async confirmPaymentByBillNo(billNo: string, note?: string): Promise<PaymentRecord> {
    const existing = await this.getByBillNo(billNo);
    return this.confirmPayment(existing.id, note);
  }

  async confirmLatestPendingForPhone(customerPhone: string, note?: string): Promise<PaymentRecord> {
    const normalized = this.requireValidPhone(customerPhone);
    const pending = await this.paymentRepository.findLatestPendingByPhone(normalized);
    if (!pending) {
      throw new NoPendingPaymentError(normalized);
    }
    return this.confirmPayment(pending.id, note);
  }

  async cancelPayment(id: string): Promise<PaymentRecord> {
    const existing = await this.getById(id);

    if (existing.status === 'CANCELLED') {
      return existing;
    }
    if (existing.status === 'PAID') {
      throw new PaymentAlreadyPaidError(existing.billNo);
    }

    const cancelled = await this.paymentRepository.markCancelled(id);
    logger.info('Payment cancelled', { paymentId: id, billNo: cancelled.billNo });
    return cancelled;
  }

  /**
   * The route layer normalizes via the zod schema, but direct service
   * callers (AI tools validate first too — belt and braces) shouldn't be
   * able to store a malformed number. Same 10-15 digit rule as the
   * schema, enforced here as the last line of defense.
   */
  private requireValidPhone(raw: string): string {
    const normalized = normalizePhoneNumber(raw);
    if (!/^[0-9]{10,15}$/.test(normalized)) {
      throw new InvalidCustomerPhoneError();
    }
    return normalized;
  }
}

function generateBillNo(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `BILL-${datePart}-${suffix}`;
}

/** Prisma unique-constraint violation (P2002) — the only error worth retrying a bill number for. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
