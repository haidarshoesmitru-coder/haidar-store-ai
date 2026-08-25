/**
 * Public surface of the Orders module. Same rule as catalog/index.ts:
 * everything outside this module imports from `@/features/orders`, never
 * from an internal path directly. Repository classes/interfaces are
 * deliberately not exported — an implementation detail of the service
 * layer.
 */

export { OrderService } from '@/features/orders/services/order.service.impl';
export type { IOrderService } from '@/features/orders/services/order.service';

export type { OrderWithDetails, CursorPage } from '@/features/orders/types';

export type { OrderResponseDto, OrderItemResponseDto, OrderStatusHistoryResponseDto } from '@/features/orders/dto/order.dto';
export { toOrderDto } from '@/features/orders/dto/order.dto';

export {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  listOrdersQuerySchema,
  NO_SHOW_BLOCK_THRESHOLD,
  type CreateOrderInput,
  type UpdateOrderStatusInput,
  type CancelOrderInput,
  type ListOrdersQuery,
} from '@/features/orders/validation/order.validation';

export {
  OrderNotFoundError,
  EmptyOrderError,
  InvalidOrderStatusTransitionError,
  DeliveryNotYetSupportedError,
  MissingGuestContactError,
  CustomerBlockedForNoShowError,
} from '@/features/orders/errors';

export { createOrderRoute } from '@/features/orders/api/handler';
