import { Type } from '@google/genai';
import { db } from '@/shared/lib/db';
import { InventoryService } from '@/features/catalog/services/inventory.service.impl';
import { VariantService } from '@/features/catalog/services/variant.service';
import { ProductService } from '@/features/catalog/services/product.service.impl';
import { OrderService } from '@/features/orders/services/order.service.impl';
import { InsufficientStockError, ProductSlugAlreadyExistsError } from '@/features/catalog/errors';

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
      discount: 0,
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

// ---------------------------------------------------------------------------
// Tool: create_new_product
// ---------------------------------------------------------------------------

/**
 * Why this exists separately from add_new_stock: that tool only ever
 * restocks a product ALREADY in the catalog — a deliberate v1 boundary,
 * because creating a product from scratch needs a category assignment
 * (Product.categoryId is required in the schema) that a bare WhatsApp
 * message doesn't naturally include. This tool is the explicit,
 * owner-requested extension of that boundary: it can create a brand-new
 * product, but ONLY once a real category is resolved — never guessed. If
 * the owner didn't name one (or named one that doesn't match anything),
 * this returns the actual list of existing categories so the AI asks a
 * real question instead of inventing a category that doesn't exist.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface CategoryMatch {
  id: string;
  name: string;
}

async function resolveCategory(categoryName: string | undefined): Promise<{
  category: CategoryMatch | null;
  allCategories: CategoryMatch[];
}> {
  const allCategories = await db.category.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!categoryName) {
    return { category: null, allCategories };
  }

  const matches = allCategories.filter((c) => c.name.toLowerCase().includes(categoryName.toLowerCase()));
  return { category: matches.length === 1 ? matches[0]! : null, allCategories };
}

export const createNewProductDeclaration = {
  name: 'create_new_product',
  description:
    "Create a BRAND NEW product that doesn't exist in the catalog yet (owner only), with its first variant and initial stock. Every product needs a category — if the owner didn't mention one, or the one they mentioned doesn't match an existing category, this returns the real list of categories so you can ask the owner which one fits. Never invent or guess a category.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productName: { type: Type.STRING, description: 'The new product\'s name, e.g. "Carezza Body Spray".' },
      categoryName: {
        type: Type.STRING,
        description: 'The category this product belongs to, matched against existing categories. Omit if the owner did not say one.',
      },
      quantity: { type: Type.NUMBER, description: 'Initial stock quantity.' },
      salePrice: { type: Type.NUMBER, description: 'Selling price per unit.' },
      purchasePrice: { type: Type.NUMBER, description: 'Purchase/cost price per unit, if mentioned.' },
    },
    required: ['productName', 'quantity', 'salePrice'],
  },
};

export async function createNewProduct(
  productName: string,
  quantity: number,
  salePrice: number,
  purchasePrice?: number,
  categoryName?: string,
): Promise<unknown> {
  const { category, allCategories } = await resolveCategory(categoryName);

  if (!category) {
    return {
      success: false,
      needsClarification: true,
      message: categoryName
        ? `"${categoryName}" naam ki category nahi mili.`
        : 'Ye naya product hai — konsi category mein rakhein?',
      availableCategories: allCategories.map((c) => c.name),
    };
  }

  const productService = new ProductService();

  try {
    await productService.createProduct({
      categoryId: category.id,
      name: productName,
      slug: slugify(productName),
      status: 'ACTIVE',
      isFeatured: false,
      isBestSeller: false,
      isNewArrival: true,
      variants: [
        {
          price: salePrice,
          ...(purchasePrice !== undefined ? { costPrice: purchasePrice } : {}),
          isDefault: true,
          attributes: [],
          initialQuantity: quantity,
        },
      ],
    });

    return {
      success: true,
      message: `"${productName}" naya product ban gaya (category: ${category.name}), ${quantity} unit stock ke sath, price Rs. ${salePrice}.`,
    };
  } catch (error) {
    if (error instanceof ProductSlugAlreadyExistsError) {
      return {
        success: false,
        message: `"${productName}" jaisa naam pehle se catalog mein maujood hai. Thora alag naam try karen ya admin panel check karen.`,
      };
    }
    throw error;
  }
}
