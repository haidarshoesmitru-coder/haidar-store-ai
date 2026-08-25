import { InventoryService, toInventoryDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { NotFoundError } from '@/shared/lib/errors';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** Current stock level + low-stock threshold for one variant. Staff+ only — not storefront-public (stock counts are operational data). */

const inventoryService = new InventoryService();

export const GET = createCatalogRoute<unknown, { variantId: string }>(
  async ({ params }) => {
    const variantId = parseUuidParam(params.variantId);
    const inventory = await inventoryService.getByVariantId(variantId);
    if (!inventory) throw new NotFoundError('Inventory', variantId);
    return { data: toInventoryDto(inventory), message: 'Inventory retrieved.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
