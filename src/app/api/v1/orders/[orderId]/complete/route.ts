import { OrderService, toOrderDto, updateOrderStatusSchema } from '@/features/orders';
import { createOrderRoute } from '@/features/orders/api/handler';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** CONFIRMED -> COMPLETED. See confirm/route.ts for the shared rationale. */

const orderService = new OrderService();

export const POST = createOrderRoute<ReturnType<typeof toOrderDto>, { orderId: string }>(
  async ({ req, user, params }) => {
    const body = validate(updateOrderStatusSchema, await req.json().catch(() => ({})));
    const order = await orderService.completeOrder(params.orderId, user?.id, body.note);
    return { data: toOrderDto(order), message: 'Order completed.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
