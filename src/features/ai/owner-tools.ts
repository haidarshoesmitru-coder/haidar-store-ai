import { Type } from '@google/genai';
import { db } from '@/shared/lib/db';
import { InventoryService } from '@/features/catalog/services/inventory.service.impl';
import { VariantService } from '@/features/catalog/services/variant.service';
import { OrderService } from '@/features/orders/services/order.service.impl';
import { InsufficientStockError } from '@/features/catalog/errors';

/**
 * Why this file exists: these two tools are only ever registered for the
 * owner (conversation.ts checks `isOwner` before including them) — a
 * customer's message never reaches this file. Both are built on top of
 * services this project already has and has already tested (Inventory's
 * stockIn, Orders' full create/confirm/complete flow, Variant's price
 * update) rather than writing new Prisma logic here, so the actual
 * stock-safety and transactional guarantees are inherited, not
 * reinvented.
 *
 * Product matching is name-based, same limitation as the customer-facing
 * search_products tool (tools.ts) — see that file for why. If more than
 * one product matches, both tools return `needsClarification` instead of
 * guessing, so the AI asks the owner which one rather than silently
 * picking.
 *
 * Known v1 limitation: `record_in_shop_sale` always uses the catalog's
 * stored price — there's no way yet to tell it "sold for a different
 * (bargained) price than the catalog price." Revisit if that turns out
 * to matter in practice; adding it means extending Orders'
 * createOrderSchema to accept a per-item price override, which this
 * sprint deliberately didn't touch given how much the Orders module has
 * already been tested and relied on.
 *
 * Dependencies: db.ts, InventoryService, VariantService, OrderService,
 * catalog/errors.ts.
 * Future usage: registered as Gemini function declarations in
 * conversation.ts, owner-only.
 */

interface VariantMatch {
  variantId: string;
  productName: string;
}

async function findMatchingVariants(query: string): Promise<VariantMatch[]> {
  const variants = await db.productVariant.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      product: { name: { contains: query, mode: 'insensitive' } },
    },
    include: { product: true },
    take: 5,
  });
  return variants.map((v) => ({ variantId: v.id, productName: v.product.name }));
}

// ---------------------------------------------------------------------------
// Tool: add_new_stock
// ---------------------------------------------------------------------------

export const addNewStockDeclaration = {
  name: 'add_new_stock',
  description:
    "Add newly arrived stock to an EXISTING product's inventory (owner only). If the product isn't in the catalog yet, this will fail — a brand-new product must be added first through the admin panel. Optionally updates the purchase price and/or selling price if the owner mentions them changed.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productName: { type: Type.STRING, description: 'The product name, e.g. "Sunsilk Shampoo".' },
      quantity: { type: Type.NUMBER, description: 'How many units arrived.' },
      purchasePrice: { type: Type.NUMBER, description: "New purchase/cost price per unit, if the owner mentioned it changed. Omit if not mentioned." },
      salePrice: { type: Type.NUMBER, description: 'New selling price per unit, if the owner mentioned it changed. Omit if not mentioned.' },
    },
    required: ['productName', 'quantity'],
  },
};

export async function addNewStock(
  productName: string,
  quantity: number,
  purchasePrice?: number,
  salePrice?: number,
): Promise<unknown> {
  const matches = await findMatchingVariants(productName);

  if (matches.length === 0) {
    return {
      success: false,
      message: `"${productName}" catalog mein nahi mila. Naya product pehle admin panel se add karen, phir stock update ho sakega.`,
    };
  }
  if (matches.length > 1) {
    return { success: false, needsClarification: true, matches: matches.map((m) => m.productName) };
  }

  const variant = matches[0];
  if (!variant) {
    return { success: false, message: `"${productName}" catalog mein nahi mila.` };
  }
  const inventoryService = new InventoryService();
  const variantService = new VariantService();

  await inventoryService.stockIn({
    variantId: variant.variantId,
    quantity,
    note: 'WhatsApp se owner ne stock add kiya',
    referenceType: 'MANUAL',
  });

  if (purchasePrice !== undefined || salePrice !== undefined) {
    await variantService.updateVariant(variant.variantId, {
      ...(salePrice !== undefined ? { price: salePrice } : {}),
      ...(purchasePrice !== undefined ? { costPrice: purchasePrice } : {}),
    });
  }

  return {
    success: true,
    message: `${variant.productName}: ${quantity} unit stock mein add ho gaya.${
      salePrice !== undefined ? ` Naya sale price: Rs. ${salePrice}.` : ''
    }${purchasePrice !== undefined ? ` Naya purchase price: Rs. ${purchasePrice}.` : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Tool: record_in_shop_sale
// ---------------------------------------------------------------------------

export const recordInShopSaleDeclaration = {
  name: 'record_in_shop_sale',
  description:
    "Record a sale that just happened in person at the shop (owner only) — deducts stock and logs the sale at the catalog's current price. Use this when the owner says a walk-in customer just bought something.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productName: { type: Type.STRING, description: 'The product that was sold, e.g. "Sunsilk Shampoo".' },
      quantity: { type: Type.NUMBER, description: 'How many units were sold.' },
    },
    required: ['productName', 'quantity'],
  },
};

export async function recordInShopSale(productName: string, quantity: number): Promise<unknown> {
  const matches = await findMatchingVariants(productName);

  if (matches.length === 0) {
    return { success: false, message: `"${productName}" catalog mein nahi mila.` };
  }
  if (matches.length > 1) {
    return { success: false, needsClarification: true, matches: matches.map((m) => m.productName) };
  }

  const variant = matches[0];
  if (!variant) {
    return { success: false, message: `"${productName}" catalog mein nahi mila.` };
  }
  const orderService = new OrderService();

  try {
    const order = await orderService.createOrder({
      source: 'ADMIN',
      fulfillmentType: 'PICKUP',
      guestName: 'In-shop Sale',
      items: [{ variantId: variant.variantId, quantity }],
    });
    await orderService.confirmOrder(order.id);
    const completed = await orderService.completeOrder(order.id);

    return {
      success: true,
      orderNumber: completed.orderNumber,
      total: Number(completed.total),
      message: `${variant.productName} x${quantity} ki sale record ho gayi. Order #${completed.orderNumber}, total Rs. ${Number(completed.total)}. Stock khud-ba-khud kam ho gaya.`,
    };
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return { success: false, message: `${variant.productName} ka itna stock available nahi hai.` };
    }
    throw error;
  }
}
