import { InventoryService, toInventoryDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** Every variant at or below its configured low-stock threshold — the data behind a future "reorder" admin view. */

const inventoryService = new InventoryService();

export const GET = createCatalogRoute(
  async () => {
    const lowStockItems = await inventoryService.listLowStock();
    return { data: lowStockItems.map(toInventoryDto), message: 'Low stock items retrieved.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
