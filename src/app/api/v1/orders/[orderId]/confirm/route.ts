import { OrderService, toOrderDto, updateOrderStatusSchema } from '@/features/orders';
import { createOrderRoute } from '@/features/orders/api/handler';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** PENDING -> CONFIRMED. 409 (InvalidOrderStatusTransitionError) if the order isn't currently PENDING. */

const orderService = new OrderService();

export const POST = createOrderRoute<ReturnType<typeof toOrderDto>, { orderId: string }>(
  async ({ req, user, params }) => {
    const body = validate(updateOrderStatusSchema, await req.json().catch(() => ({})));
    const order = await orderService.confirmOrder(params.orderId, user?.id, body.note);
    return { data: toOrderDto(order), message: 'Order confirmed.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
