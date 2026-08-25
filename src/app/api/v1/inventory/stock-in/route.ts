import { InventoryService, toInventoryTransactionDto, stockInRequestSchema } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { validate } from '@/shared/validation/validate';
import { stripUndefined } from '@/shared/utils/strip-undefined';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: POST-only endpoint for recording stock received
 * (supplier delivery, manual correction upward). Requires `staff` per the
 * RBAC table ("record stock movements" = staff+) — the lowest bar of any
 * write endpoint in this module, since this is routine day-to-day
 * operational work, not a catalog-structure change.
 *
 * `performedByUserId` is taken from the authenticated session, never from
 * the request body — a client cannot claim a stock entry was made by
 * someone else.
 */

const inventoryService = new InventoryService();

export const POST = createCatalogRoute(
  async ({ req, user }) => {
    // requiredRoleLevel: ROLE_LEVEL.staff below guarantees requireRole() has
    // already thrown UnauthorizedError for a null user before this line
    // runs — this narrows the type to match that runtime guarantee.
    if (!user) throw new Error('unreachable: requireRole guarantees a user');
    const body = validate(stockInRequestSchema, await req.json());
    const transaction = await inventoryService.stockIn(stripUndefined({ ...body, performedByUserId: user.id }));
    return { data: toInventoryTransactionDto(transaction), message: 'Stock added.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
