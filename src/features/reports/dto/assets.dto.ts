/**
 * Why this file exists: the response shape for "kitna maal hai / kitni
 * Zakat deni hai" — total inventory valuation plus the Zakat due on it.
 * Deliberately scoped to read-only aggregation over the existing
 * ProductVariant/Inventory data — no new tables, matching the project's
 * "derive, don't duplicate" rule (see daily-sales.service.ts). A variant's
 * value is its on-hand quantity times its purchase price (sale price as
 * fallback where purchase price was never recorded).
 *
 * Dependencies: none (plain types).
 * Future usage: assets.service.ts builds this; the API route, admin
 * assets page, and the WhatsApp get_total_assets owner tool all consume it.
 */

export interface CategoryValuationDto {
  categoryName: string;
  value: number;
  units: number;
}

export interface InventoryValuationDto {
  /** Total inventory value in Rs. (qty × purchase price, sale price where purchase price missing). */
  totalValue: number;
  /** Zakat due in Rs. = totalValue × ZAKAT_RATE (0.025). */
  zakat: number;
  totalUnits: number;
  variantCount: number;
  productCount: number;
  /** Variants valued at sale price because their purchase (cost) price was never recorded. */
  fallbackCount: number;
  byCategory: CategoryValuationDto[];
}
