import { PaymentService, toPaymentDto, createPaymentSchema } from '@/features/payments';
import { createPaymentRoute } from '@/features/payments/api/handler';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * POST creates a QR bill: validates the amount/phone, generates the bill
 * number and QR (via the configured PaymentProvider), stores the payment
 * as PENDING, and returns the QR's PNG data URL so the caller (admin UI
 * or WhatsApp tool) can forward it immediately. Manager+ only — creating
 * a bill is creating a payment obligation, not a staff-level action.
 */

const paymentService = new PaymentService();

export const POST = createPaymentRoute(
  async ({ req, user }) => {
    const body = validate(createPaymentSchema, await req.json());
    const { payment, qrImageDataUrl } = await paymentService.createPayment(body, user?.id ?? null);
    return { data: toPaymentDto(payment, qrImageDataUrl), message: 'Bill QR tayyar hai.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
