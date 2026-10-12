import { db } from '@/shared/lib/db';
import type { InventoryValuationDto, CategoryValuationDto } from '@/features/reports/dto/assets.dto';

/**
 * Why this file exists: Haidar's "kul kitna maal hai" number — the total
 * value of everything sitting in the shop, plus the Zakat due on it.
 * Like daily-sales.service.ts, this is a read-only aggregation over rows
 * the Catalog module already writes: every ProductVariant carries a
 * purchase (cost) price and an Inventory row carries the on-hand
 * quantity, so the valuation is derived fresh each time rather than
 * stored and left to go stale.
 *
 * Valuation rule: value per variant = quantityOnHand × costPrice. Where
 * the owner never recorded a purchase price (older catalog entries),
 * the sale price is used as the fallback so the variant still counts
 * instead of silently vanishing from the total — those variants are
 * counted separately as `fallbackCount` so the owner knows the total
 * is slightly approximate there.
 *
 * Only ACTIVE, non-deleted variants count — DRAFT or deleted products
 * are not sellable stock and must not inflate the Zakat base.
 *
 * ZAKAT_RATE = 0.025: Islamic Zakat on trade inventory (urud al-tijarah)
 * is 2.5% of its value. Haidar asked for this number explicitly so he
 * knows "kitni Zakat deni hai".
 *
 * Dependencies: db.ts, assets.dto.ts.
 * Future usage: the assets API route, the admin assets page, and the
 * WhatsApp get_total_assets owner tool.
 */

/** Islamic Zakat rate on business/trade inventory: 2.5%. */
export const ZAKAT_RATE = 0.025;

/** "Rs. 1,50,000" — Pakistani digit grouping for WhatsApp/admin display. */
export function formatRupeesPK(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

export async function getInventoryValuation(): Promise<InventoryValuationDto> {
  const variants = await db.productVariant.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      product: { status: 'ACTIVE', deletedAt: null },
    },
    include: {
      product: { include: { category: true } },
      inventory: true,
    },
  });

  let totalValue = 0;
  let totalUnits = 0;
  let fallbackCount = 0;
  const productIds = new Set<string>();
  const byCategory = new Map<string, { value: number; units: number }>();

  for (const variant of variants) {
    const quantity = variant.inventory?.quantityOnHand ?? 0;
    if (quantity <= 0) continue;

    // Prisma Decimal → number, same as the AI search tools do.
    const unitValue =
      variant.costPrice !== null ? Number(variant.costPrice) : Number(variant.price);
    if (variant.costPrice === null) fallbackCount++;

    const value = quantity * unitValue;
    totalValue += value;
    totalUnits += quantity;
    productIds.add(variant.productId);

    const categoryName = variant.product.category?.name ?? 'Uncategorized';
    const existing = byCategory.get(categoryName);
    if (existing) {
      existing.value += value;
      existing.units += quantity;
    } else {
      byCategory.set(categoryName, { value, units: quantity });
    }
  }

  const byCategoryList: CategoryValuationDto[] = Array.from(byCategory.entries())
    .map(([categoryName, data]) => ({ categoryName, ...data }))
    .sort((a, b) => b.value - a.value);

  return {
    totalValue,
    zakat: totalValue * ZAKAT_RATE,
    totalUnits,
    variantCount: variants.length,
    productCount: productIds.size,
    fallbackCount,
    byCategory: byCategoryList,
  };
}
