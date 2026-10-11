import { Type } from '@google/genai';
import { db } from '@/shared/lib/db';

/**
 * Why this file exists: the AI never queries the database directly — it
 * calls this function (via Gemini's function-calling), and this function
 * decides exactly what data comes back. That's deliberate: hiding
 * cost/purchase price from customers has to be a hard, code-level
 * guarantee (per the explicit business rule), not something the AI is
 * merely instructed not to mention. `costPrice` is only ever included in
 * the object this function returns when `isOwner` is true — a customer
 * conversation never receives that field at all, so there's nothing for
 * the model to leak even if asked cleverly.
 *
 * v1 scope: name-based search only (no photo-to-product matching — see
 * the webhook route's comment for why that's out of scope for now).
 * Matches against Product.name and ProductVariant.sku, case-insensitive,
 * substring match — good enough for "shampoo" finding "Sunsilk Shampoo
 * 200ml" without needing exact spelling.
 *
 * Dependencies: db.ts.
 * Future usage: conversation.ts registers this as a Gemini function
 * declaration and calls it when the model requests it.
 */

export interface ProductSearchResult {
  productName: string;
  variantId: string;
  sku: string | null;
  price: number;
  costPrice?: number;
  inStock: boolean;
  quantityAvailable: number;
}

/**
 * Typo-tolerant search tokens. Real incident (Oct 11, 2026): a customer
 * wrote "Sunslik shampoo 400ml" (misspelled Sunsilk) — the phrase-contains
 * query found nothing, so the model burned all 3 tool rounds retrying
 * spelling variations and the user got the max-rounds fallback. Splitting
 * the query into significant words means one correct word ("shampoo") is
 * enough to surface candidates the model can then pick from or clarify
 * about, instead of failing on one misspelled word.
 */
const SEARCH_STOPWORDS = new Set([
  // Roman Urdu filler words — never product names
  'hai', 'hain', 'ho', 'ga', 'gi', 'ge', 'ka', 'ki', 'ko', 'ke', 'mein', 'me',
  'se', 'aur', 'ya', 'kya', 'nahi', 'nahin', 'koi', 'yeh', 'ye', 'woh', 'wo',
  'wala', 'wali', 'wale', 'walay', 'chahiye', 'chahye', 'batao', 'batain',
  'kitne', 'kitna', 'kitni', 'kaunsa', 'kaunsi', 'mujhe', 'mujhay',
  // English filler words
  'the', 'a', 'an', 'and', 'or', 'is', 'are', 'it', 'of', 'for', 'in', 'on',
  'to', 'do', 'does', 'have', 'has', 'i', 'you', 'me', 'my', 'we',
]);

export function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !SEARCH_STOPWORDS.has(t));
}

/** Shared variant lookup: matches ANY of the given terms (name or SKU). */
async function findVariantsByTerms(terms: string[]) {
  return db.productVariant.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      OR: terms.flatMap((term) => [
        { product: { name: { contains: term, mode: 'insensitive' as const } } },
        { sku: { contains: term, mode: 'insensitive' as const } },
      ]),
    },
    include: {
      product: true,
      inventory: true,
    },
    take: 5,
  });
}

export async function searchProducts(query: string, isOwner: boolean): Promise<ProductSearchResult[]> {
  // Stage 1: exact phrase — precise when the spelling is right.
  let variants = await findVariantsByTerms([query]);

  // Stage 2 (only when stage 1 finds nothing): any significant word
  // matches — typo-tolerant, e.g. "Sunslik shampoo 400ml" still finds
  // shampoos via "shampoo" and "400ml".
  if (variants.length === 0) {
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length > 0) {
      variants = await findVariantsByTerms(tokens);
    }
  }

  return variants.map((variant) => {
    const result: ProductSearchResult = {
      productName: variant.product.name,
      variantId: variant.id,
      sku: variant.sku,
      price: Number(variant.price),
      inStock: (variant.inventory?.quantityOnHand ?? 0) > 0,
      quantityAvailable: variant.inventory?.quantityOnHand ?? 0,
    };

    // Only path in the whole system where a WhatsApp conversation can
    // learn a cost price — and it's gated here, not in the prompt.
    if (isOwner && variant.costPrice !== null) {
      result.costPrice = Number(variant.costPrice);
    }

    return result;
  });
}

/** The Gemini function-declaration schema for `searchProducts`, shared with conversation.ts. */
export const searchProductsDeclaration = {
  name: 'search_products',
  description:
    "Search the shop's product catalog by name or SKU. Returns matching products with price and stock availability. Use this whenever a customer asks about a product, its price, or whether it's in stock.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The product name or keyword to search for, e.g. "shampoo" or "Nike shoes".',
      },
    },
    required: ['query'],
  },
};
