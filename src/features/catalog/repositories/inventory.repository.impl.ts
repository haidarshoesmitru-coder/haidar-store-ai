import { db } from '@/shared/lib/db';
import type { InventoryTransaction, LowStockConfiguration } from '@prisma/client';
import type { IInventoryRepository } from '@/features/catalog/repositories/inventory.repository';
import type { InventoryWithConfig, CursorPage } from '@/features/catalog/types';

/**
 * Why this file exists: the concrete Inventory aggregate repository. The
 * one rule that matters most here — restated from the Sprint 2.1
 * interface's own doc comment — is that `recordTransaction` is the ONLY
 * method that touches `quantityOnHand`, and it does so inside a single
 * Prisma `$transaction` alongside the `InventoryTransaction` insert. No
 * other method in this class, or anywhere else in the codebase, updates
 * that field directly. `increaseStock`/`decreaseStock`/`adjustStock`/
 * `createTransaction` (the method names this sprint's spec asks for) are
 * all thin, named wrappers around this one transactional core — not four
 * independent write paths.
 *
 * See category.repository.impl.ts for the shared "why not BaseRepository" rationale.
 *
 * Dependencies: db.ts, inventory.repository.ts (interface), catalog/types.ts.
 * Future usage: constructed by inventory.service.impl.ts; later, the
 * Orders module will call `decreaseStock`/`increaseStock` for
 * SALE/RETURN transactions.
 */
/**
 * Extended beyond Sprint 2.1's IInventoryRepository with a cheap
 * current-stock read — see the matching note in
 * category.repository.impl.ts for the full rationale.
 */
export interface IInventoryRepositoryExtended extends IInventoryRepository {
  getCurrentStock(variantId: string): Promise<number | null>;
}

export class PrismaInventoryRepository implements IInventoryRepositoryExtended {
  async findByVariantId(variantId: string): Promise<InventoryWithConfig | null> {
    const [inventory, lowStockConfig] = await Promise.all([
      db.inventory.findUnique({ where: { variantId } }),
      db.lowStockConfiguration.findUnique({ where: { variantId } }),
    ]);
    if (!inventory) return null;
    return { ...inventory, lowStockConfig };
  }

  async initializeForVariant(variantId: string): Promise<InventoryWithConfig> {
    const inventory = await db.inventory.create({
      data: { variantId, quantityOnHand: 0, quantityReserved: 0 },
    });
    return { ...inventory, lowStockConfig: null };
  }

  /**
   * The single write path. Everything else on this class and on
   * InventoryService delegates here. Runs the balance update and the
   * ledger insert in one database transaction — an InventoryTransaction
   * row can never exist without the corresponding balance change, or vice
   * versa, even if the process crashes mid-operation.
   */
  async recordTransaction(
    variantId: string,
    input: Omit<InventoryTransaction, 'id' | 'inventoryId' | 'createdAt'>,
  ): Promise<InventoryTransaction> {
    return db.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUniqueOrThrow({ where: { variantId } });

      await tx.inventory.update({
        where: { variantId },
        data: { quantityOnHand: inventory.quantityOnHand + input.quantity },
      });

      return tx.inventoryTransaction.create({
        data: { ...input, inventoryId: inventory.id },
      });
    });
  }

  async findTransactionHistory(
    variantId: string,
    cursor?: string,
    limit = 50,
  ): Promise<CursorPage<InventoryTransaction>> {
    const inventory = await db.inventory.findUnique({ where: { variantId } });
    if (!inventory) {
      return { data: [], nextCursor: null, hasMore: false };
    }

    const rows = await db.inventoryTransaction.findMany({
      where: { inventoryId: inventory.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore };
  }

  async findLowStock(): Promise<InventoryWithConfig[]> {
    const [inventoryRows, configRows] = await Promise.all([
      db.inventory.findMany(),
      db.lowStockConfiguration.findMany(),
    ]);
    const configByVariantId = new Map(configRows.map((c) => [c.variantId, c]));
    const rows: InventoryWithConfig[] = inventoryRows.map((inv) => ({
      ...inv,
      lowStockConfig: configByVariantId.get(inv.variantId) ?? null,
    }));
    // Threshold comparison happens here (not in a WHERE clause) because it
    // compares two columns on related tables (Inventory.quantityOnHand vs
    // LowStockConfiguration.threshold) — Prisma can't express a
    // column-to-column comparison across a relation in `where` without a
    // raw query. For the foundation's expected data volumes this is fine;
    // a raw SQL version is a drop-in replacement if it ever needs to scale.
    return rows.filter(
      (row) => row.lowStockConfig?.isEnabled && row.quantityOnHand <= row.lowStockConfig.threshold,
    );
  }

  async setLowStockConfiguration(
    variantId: string,
    input: Omit<LowStockConfiguration, 'id' | 'variantId' | 'updatedAt'>,
  ): Promise<LowStockConfiguration> {
    return db.lowStockConfiguration.upsert({
      where: { variantId },
      create: { variantId, ...input },
      update: input,
    });
  }

  /** Extra — direct current-stock read, without the full InventoryWithConfig join, for cheap availability checks. */
  async getCurrentStock(variantId: string): Promise<number | null> {
    const inventory = await db.inventory.findUnique({
      where: { variantId },
      select: { quantityOnHand: true },
    });
    return inventory?.quantityOnHand ?? null;
  }
}
