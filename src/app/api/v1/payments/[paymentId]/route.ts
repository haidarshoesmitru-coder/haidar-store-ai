import { PaymentService, toPaymentDto } from '@/features/payments';
import { createPaymentRoute } from '@/features/payments/api/handler';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** GET returns a bill's current status (PENDING / PAID / CANCELLED). 404 (PaymentNotFoundError) for an unknown id. */

const paymentService = new PaymentService();

export const GET = createPaymentRoute<ReturnType<typeof toPaymentDto>, { paymentId: string }>(
  async ({ params }) => {
    const payment = await paymentService.getById(params.paymentId);
    // Status reads don't re-render the QR — the data URL is only
    // returned on create, where it's needed immediately.
    return { data: toPaymentDto(payment, null), message: 'OK' };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
