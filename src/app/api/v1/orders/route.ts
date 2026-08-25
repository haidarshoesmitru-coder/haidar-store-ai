import { OrderService, toOrderDto, createOrderSchema, listOrdersQuerySchema } from '@/features/orders';
import { createOrderRoute } from '@/features/orders/api/handler';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * POST creates an order (checkout — website today, WhatsApp AI / admin
 * later per `source`). GET lists orders, filterable by status/customer,
 * for the admin panel's orders view. Both require at least staff level —
 * neither is a public, unauthenticated route yet (the WhatsApp AI service
 * will call this as an authenticated internal service account once it
 * exists, not as an anonymous request).
 */

const orderService = new OrderService();

export const POST = createOrderRoute(
  async ({ req }) => {
    const body = validate(createOrderSchema, await req.json());
    const order = await orderService.createOrder(body);
    return { data: toOrderDto(order), message: 'Order placed.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);

export const GET = createOrderRoute(
  async ({ req }) => {
    const query = validate(listOrdersQuerySchema, Object.fromEntries(req.nextUrl.searchParams));
    const page = await orderService.list(query);
    return {
      data: page.data.map(toOrderDto),
      message: 'OK',
      meta: { nextCursor: page.nextCursor, hasMore: page.hasMore },
    };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
