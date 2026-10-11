import { PaymentService, toPaymentDto, confirmPaymentSchema } from '@/features/payments';
import { createPaymentRoute } from '@/features/payments/api/handler';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * POST marks a bill PAID (manual confirmation — the owner saw the money
 * arrive). Idempotent: confirming an already-PAID bill succeeds as a
 * no-op. 404 (PaymentNotFoundError) for an unknown id, 409
 * (PaymentAlreadyCancelledError) for a CANCELLED bill. Manager+ only.
 */

const paymentService = new PaymentService();

export const POST = createPaymentRoute<ReturnType<typeof toPaymentDto>, { paymentId: string }>(
  async ({ req, params }) => {
    const body = validate(confirmPaymentSchema, await req.json().catch(() => ({})));
    const payment = await paymentService.confirmPayment(params.paymentId, body.note);
    return { data: toPaymentDto(payment, null), message: 'Payment confirmed.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
