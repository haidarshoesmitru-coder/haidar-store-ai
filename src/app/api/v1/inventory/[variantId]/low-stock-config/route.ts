import { InventoryService, setLowStockConfigurationSchema } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: PUT for setting a variant's low-stock threshold —
 * new in Sprint 2.4. `InventoryService.setLowStockConfiguration` has
 * existed since Sprint 2.2, and Sprint 2.1 already defined the Zod schema
 * for it (`setLowStockConfigurationSchema`) — but Sprint 2.3's endpoint
 * list never included it. Filling the gap, reusing both unmodified.
 */

const inventoryService = new InventoryService();

export const PUT = createCatalogRoute<unknown, { variantId: string }>(
  async ({ req, params }) => {
    const variantId = parseUuidParam(params.variantId);
    const body = validate(setLowStockConfigurationSchema, { ...(await req.json()), variantId });
    await inventoryService.setLowStockConfiguration(body);
    return { data: null, message: 'Low stock threshold updated.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
