import { OrderService, toOrderDto } from '@/features/orders';
import { cancelOrderSchema } from '@/features/orders/validation/order.validation';
import { createOrderRoute } from '@/features/orders/api/handler';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * PENDING or CONFIRMED -> CANCELLED. `reason` is required — passing
 * `"NO_SHOW"` is what feeds the no-show protection policy
 * (order.service.impl.ts's createOrder). Restocks every line back onto
 * Inventory as part of the same transaction (see
 * order.repository.impl.ts's updateStatus). 409 if already
 * COMPLETED/CANCELLED.
 */

const orderService = new OrderService();

export const POST = createOrderRoute<ReturnType<typeof toOrderDto>, { orderId: string }>(
  async ({ req, user, params }) => {
    const body = validate(cancelOrderSchema, await req.json());
    const order = await orderService.cancelOrder(params.orderId, body.reason, user?.id, body.note);
    return { data: toOrderDto(order), message: 'Order cancelled.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
