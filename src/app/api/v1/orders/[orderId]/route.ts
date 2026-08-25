import { OrderService, toOrderDto } from '@/features/orders';
import { OrderNotFoundError } from '@/features/orders/errors';
import { createOrderRoute } from '@/features/orders/api/handler';
import { ROLE_LEVEL } from '@/server/auth/rbac';

const orderService = new OrderService();

export const GET = createOrderRoute<ReturnType<typeof toOrderDto>, { orderId: string }>(
  async ({ params }) => {
    const order = await orderService.getById(params.orderId);
    if (!order) {
      throw new OrderNotFoundError(params.orderId);
    }
    return { data: toOrderDto(order) };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
