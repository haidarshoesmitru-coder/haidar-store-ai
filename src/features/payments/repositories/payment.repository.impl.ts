import { db } from '@/shared/lib/db';
import type { Payment } from '@prisma/client';
import type {
  IPaymentRepository,
  CreatePaymentData,
} from '@/features/payments/repositories/payment.repository';
import type { PaymentRecord } from '@/features/payments/types';

/**
 * Why this file exists: the concrete Payment repository — thin Prisma
 * calls, no business rules. All state-machine decisions (can this bill be
 * confirmed? is it already paid?) live in payment.service.impl.ts; this
 * file writes what it's told to write.
 *
 * Dependencies: db.ts, payment.repository.ts (interface), payments/types.ts.
 * Future usage: constructed by payment.service.impl.ts.
 */

export class PrismaPaymentRepository implements IPaymentRepository {
  async findById(id: string): Promise<PaymentRecord | null> {
    return db.payment.findUnique({ where: { id } });
  }

  async findByBillNo(billNo: string): Promise<PaymentRecord | null> {
    return db.payment.findUnique({ where: { billNo } });
  }

  async findLatestPendingByPhone(customerPhone: string): Promise<PaymentRecord | null> {
    return db.payment.findFirst({
      where: { customerPhone, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreatePaymentData): Promise<PaymentRecord> {
    return db.payment.create({
      data: {
        billNo: data.billNo,
        orderId: data.orderId,
        amountPaisa: data.amountPaisa,
        currency: 'PKR',
        method: data.method,
        status: 'PENDING',
        qrPayload: data.qrPayload,
        customerPhone: data.customerPhone,
        description: data.description,
        createdByUserId: data.createdByUserId,
      },
    });
  }

  async markPaid(id: string, paidAt: Date): Promise<Payment> {
    return db.payment.update({
      where: { id },
      data: { status: 'PAID', paidAt },
    });
  }

  async markCancelled(id: string): Promise<Payment> {
    return db.payment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
