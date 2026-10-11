/**
 * Public surface of the Payments module.
 *
 * Why this file exists: same rule as orders/index.ts — everything outside
 * this module imports from `@/features/payments`, never from an internal
 * path directly. Repository classes/interfaces are deliberately not
 * exported — an implementation detail of the service layer.
 *
 * What's deliberately NOT exported: the repository. Route handlers and AI
 * tools depend on the service, always.
 */

// Services — the module's actual public API
export { PaymentService } from '@/features/payments/services/payment.service.impl';
export type { IPaymentService } from '@/features/payments/services/payment.service';

// Domain types
export type { PaymentRecord } from '@/features/payments/types';

// DTOs
export type { PaymentResponseDto } from '@/features/payments/dto/payment.dto';
export { toPaymentDto } from '@/features/payments/dto/payment.dto';

// Validation (also used by the WhatsApp AI tools so tool input and HTTP
// input are validated by the exact same schemas)
export {
  createPaymentSchema,
  confirmPaymentSchema,
  normalizePhoneNumber,
  type CreatePaymentInput,
  type ConfirmPaymentInput,
} from '@/features/payments/validation/payment.validation';

// Errors
export {
  PaymentNotFoundError,
  PaymentBillNotFoundError,
  NoPendingPaymentError,
  PaymentAlreadyCancelledError,
  PaymentAlreadyPaidError,
  InvalidCustomerPhoneError,
} from '@/features/payments/errors';

// Provider seam — the interface every billing flow depends on, plus the
// current static-QR implementation and the shared rupees formatter.
export type {
  PaymentProvider,
  QrBillInput,
  GeneratedQr,
} from '@/features/payments/providers/payment-provider';
export { StaticQrProvider, formatRupees } from '@/features/payments/providers/payment-provider';

// Route wrapper for app/api/v1/payments/**
export { createPaymentRoute } from '@/features/payments/api/handler';
