import { InventoryService, toInventoryTransactionDto, stockOutRequestSchema } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { validate } from '@/shared/validation/validate';
import { stripUndefined } from '@/shared/utils/strip-undefined';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** See stock-in/route.ts for the shared rationale. Rejects (409, InsufficientStockError) if the removal would take stock negative. */

const inventoryService = new InventoryService();

export const POST = createCatalogRoute(
  async ({ req, user }) => {
    // requiredRoleLevel: ROLE_LEVEL.staff below guarantees requireRole() has
    // already thrown UnauthorizedError for a null user before this line
    // runs — this narrows the type to match that runtime guarantee.
    if (!user) throw new Error('unreachable: requireRole guarantees a user');
    const body = validate(stockOutRequestSchema, await req.json());
    const transaction = await inventoryService.stockOut(stripUndefined({ ...body, performedByUserId: user.id }));
    return { data: toInventoryTransactionDto(transaction), message: 'Stock removed.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
