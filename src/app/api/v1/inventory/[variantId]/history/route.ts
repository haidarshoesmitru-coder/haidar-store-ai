import { InventoryService, toInventoryTransactionDto, inventoryHistoryQuerySchema } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseSearchParams, parseUuidParam } from '@/features/catalog/api/query';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** Paginated stock-movement ledger for one variant — the audit trail behind its current stock number. */

const inventoryService = new InventoryService();

export const GET = createCatalogRoute<unknown, { variantId: string }>(
  async ({ req, params }) => {
    const variantId = parseUuidParam(params.variantId);
    const query = parseSearchParams(req, inventoryHistoryQuerySchema);
    const page = await inventoryService.getTransactionHistory(variantId, query.cursor, query.limit);
    return {
      data: page.data.map(toInventoryTransactionDto),
      message: 'Inventory history retrieved.',
      meta: { pagination: { nextCursor: page.nextCursor, hasMore: page.hasMore } },
    };
  },
  { requiredRoleLevel: ROLE_LEVEL.staff },
);
