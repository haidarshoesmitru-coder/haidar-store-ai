import { InventoryService, toInventoryTransactionDto, adjustInventoryRequestSchema } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { validate } from '@/shared/validation/validate';
import { stripUndefined } from '@/shared/utils/strip-undefined';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: manual stock corrections (a miscount, damaged
 * goods written off) — the one inventory mutation where a note is
 * required, not optional (see adjustInventoryRequestSchema), since an
 * unexplained correction is exactly the kind of change an audit trail
 * needs a reason attached to.
 */

const inventoryService = new InventoryService();

export const POST = createCatalogRoute(
  async ({ req, user }) => {
    // requiredRoleLevel: ROLE_LEVEL.staff below guarantees requireRole() has
    // already thrown UnauthorizedError for a null user before this line
    // runs — this narrows the type to match that runtime guarantee.
    if (!user) throw new Error('unreachable: requireRole guarantees a user');
    const body = validate(adjustInventoryRequestSchema, await req.json());
    const transaction = await inventoryService.adjustInventory(stripUndefined({ ...body, performedByUserId: user.id }));
    return { data: toInventoryTransactionDto(transaction), message: 'Inventory adjusted.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
