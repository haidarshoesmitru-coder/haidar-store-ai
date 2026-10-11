import { Type } from '@google/genai';
import { db } from '@/shared/lib/db';
import { tokenizeSearchQuery } from '@/features/ai/tools';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';
import { ValidationError } from '@/shared/lib/errors';
import { validate } from '@/shared/validation/validate';
import { sendTextMessage, sendImageMessage } from '@/features/whatsapp/client';
import { InventoryService } from '@/features/catalog/services/inventory.service.impl';
import { VariantService } from '@/features/catalog/services/variant.service';
import { ProductService } from '@/features/catalog/services/product.service.impl';
import { CategoryService } from '@/features/catalog/services/category.service.impl';
import { OrderService } from '@/features/orders/services/order.service.impl';
import { InsufficientStockError, ProductSlugAlreadyExistsError, CategoryAlreadyExistsError } from '@/features/catalog/errors';
import {
  PaymentService,
  createPaymentSchema,
  formatRupees,
  PaymentBillNotFoundError,
  NoPendingPaymentError,
  PaymentAlreadyCancelledError,
} from '@/features/payments';

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
  // Stage 1: exact phrase — precise when the spelling is right.
  let variants = await db.productVariant.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      product: { name: { contains: query, mode: 'insensitive' } },
    },
    include: { product: true },
    take: 5,
  });

  // Stage 2 (only when stage 1 finds nothing): typo-tolerant — any
  // significant word matches, so "Sunslik 400ml" still finds Sunsilk
  // products via "400ml" instead of failing the whole stock/sale action.
  if (variants.length === 0) {
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length > 0) {
      variants = await db.productVariant.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          OR: tokens.map((term) => ({
            product: { name: { contains: term, mode: 'insensitive' as const } },
          })),
        },
        include: { product: true },
        take: 5,
      });
    }
  }

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

// ---------------------------------------------------------------------------
// Tool: create_category
// ---------------------------------------------------------------------------

/**
 * Why this exists: create_new_product needs a REAL category, and the owner
 * often names one that doesn't exist yet (e.g. "Body Spray"). Before this
 * tool, the AI's only answer was "Admin Panel se bana len" — a flow-killer
 * in the middle of a WhatsApp conversation. Now the AI creates the category
 * itself and continues with the product in the next turn, so "new category
 * bna do" just works. Owner-only, like every tool in this file.
 */

export const createNewCategoryDeclaration = {
  name: 'create_category',
  description:
    "Create a NEW product category (owner only) — use when the owner asks for a new category (e.g. 'new category bna do') or names a category that doesn't exist yet. Returns the created category so create_new_product can use it right away.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      categoryName: { type: Type.STRING, description: 'The new category name, e.g. "Body Spray".' },
    },
    required: ['categoryName'],
  },
};

export async function createNewCategory(categoryName: string): Promise<unknown> {
  const name = categoryName.trim();
  if (!name) {
    return { success: false, message: 'Category ka naam batayen.' };
  }

  const categoryService = new CategoryService();
  try {
    const category = await categoryService.createCategory({
      name,
      slug: slugify(name),
      sortOrder: 0,
    });
    return {
      success: true,
      message: `"${category.name}" category ban gayi. Ab is mein product add kar sakte hain.`,
      category: { id: category.id, name: category.name },
    };
  } catch (error) {
    if (error instanceof CategoryAlreadyExistsError) {
      // Duplicate slug — the category is effectively there; fetch it so
      // the product-creation flow can continue instead of dying.
      const existing = await db.category.findFirst({
        where: { slug: slugify(name) },
        select: { id: true, name: true },
      });
      return {
        success: true,
        alreadyExisted: true,
        message: `"${existing?.name ?? name}" category pehle se maujood hai — isi ko use karen.`,
        category: existing ? { id: existing.id, name: existing.name } : null,
      };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Tool: create_bill_qr
// ---------------------------------------------------------------------------

/**
 * Why this tool exists separately from record_in_shop_sale: that tool
 * records a sale at the CATALOG price and deducts stock — but a QR bill
 * is for the FINAL AGREED amount, which after mol-tol/bargaining is often
 * different from the catalog price (and the Orders module still has no
 * per-item price override). So this tool does payment only: it creates
 * the bill, renders the QR, and delivers it to the customer's WhatsApp.
 * Stock deduction stays with record_in_shop_sale for now; the two get
 * unified once price overrides exist.
 *
 * The QR image goes out via sendImageMessage (media upload + image
 * message). If that fails, the bill itself is safely stored, so the tool
 * falls back to a text message carrying the same payment details —
 * the customer is never left with nothing.
 */

export const createBillQrDeclaration = {
  name: 'create_bill_qr',
  description:
    "Create a payable bill with a JazzCash QR code (owner only). Use when the owner gives a FINAL bill amount (after any bargaining/mol-tol) and the customer's WhatsApp number — e.g. 'Ali ko 1500 ka bill bhejo, number 923001234567'. Creates the bill record, generates the QR, and sends the QR image to the customer on WhatsApp. The QR amount is always the final agreed amount — never the catalog price.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      amountRupees: {
        type: Type.NUMBER,
        description: 'Final agreed bill amount in whole rupees (after bargaining).',
      },
      customerPhone: {
        type: Type.STRING,
        description: "Customer's WhatsApp number, digits with country code, e.g. '923001234567'.",
      },
      description: {
        type: Type.STRING,
        description: 'What the bill is for, e.g. "2x Sunsilk Shampoo". Omit if the owner did not say.',
      },
    },
    required: ['amountRupees', 'customerPhone'],
  },
};

export async function createBillQr(
  amountRupees: number,
  customerPhone: string,
  description?: string,
): Promise<unknown> {
  // Same schema the HTTP route uses — the tool and the API can never
  // disagree on what a valid bill looks like.
  let input;
  try {
    input = validate(createPaymentSchema, {
      amountRupees: Math.round(amountRupees),
      customerPhone,
      ...(description ? { description } : {}),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      const issues = error.details?.map((d) => d.issue).join(' ') ?? 'Ghalat input.';
      return { success: false, message: `Bill nahi ban saka: ${issues}` };
    }
    throw error;
  }

  const paymentService = new PaymentService();
  // WhatsApp-owner bills aren't tied to a staff User row — attribution
  // comes from the isOwner check in the webhook, so createdBy is null.
  const { payment, qrImageDataUrl } = await paymentService.createPayment(input, null);

  const amountText = `Rs. ${formatRupees(payment.amountPaisa)}`;
  const caption =
    `Haidar Store — Bill ${payment.billNo}\n` +
    `Amount: ${amountText}\n` +
    'Is QR ko scan karen — JazzCash number aur amount nazar aayega. Apne JazzCash app se is number par payment bhejen.';

  try {
    await sendImageMessage(payment.customerPhone, qrImageDataUrl, caption);
  } catch (error) {
    logger.warn('QR image send failed, falling back to text', {
      billNo: payment.billNo,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendTextMessage(
      payment.customerPhone,
      `Haidar Store — Bill ${payment.billNo}\n` +
        `Amount: ${amountText}\n` +
        `QR image bhejne mein masla hua — barah-e-karam JazzCash app se is number par ${amountText} bhejen: ${env.JAZZCASH_NUMBER}\n` +
        `(Ref: ${payment.billNo})`,
    );
    return {
      success: true,
      billNo: payment.billNo,
      amountRupees: payment.amountPaisa / 100,
      qrSentAs: 'text-fallback',
      message: `Bill ${payment.billNo} ban gaya (${amountText}). QR image nahi bheja ja saka, is liye payment details text message mein customer ko bhej di hain.`,
    };
  }

  return {
    success: true,
    billNo: payment.billNo,
    amountRupees: payment.amountPaisa / 100,
    qrSentAs: 'image',
    message: `Bill ${payment.billNo} ban gaya (${amountText}) — QR customer ko WhatsApp par bhej diya hai.`,
  };
}

// ---------------------------------------------------------------------------
// Tool: confirm_payment
// ---------------------------------------------------------------------------

/**
 * Why the thank-you send is best-effort: the bill is PAID the moment
 * markPaid commits — the customer's thank-you message is a courtesy, not
 * the transaction. If sending fails, the tool reports success with
 * thankYouSent=false so the AI tells the owner to confirm verbally
 * instead of pretending the message went out.
 */

export const confirmPaymentDeclaration = {
  name: 'confirm_payment',
  description:
    "Mark a QR bill as PAID after the owner confirms the money arrived (owner only). Use when the owner says payment received — e.g. 'Ali ke 1500 aa gaye' or 'BILL-20261011-4821 ki payment mil gayi'. Provide EITHER the bill number OR the customer's WhatsApp number (their latest pending bill is confirmed). The customer automatically gets a thank-you message on WhatsApp in Urdu.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      billNo: {
        type: Type.STRING,
        description: 'Bill number, e.g. "BILL-20261011-4821". Provide this or customerPhone.',
      },
      customerPhone: {
        type: Type.STRING,
        description: "Customer's WhatsApp number (digits with country code) — their latest PENDING bill is confirmed.",
      },
    },
  },
};

export async function confirmPaymentByOwner(billNo?: string, customerPhone?: string): Promise<unknown> {
  if (!billNo && !customerPhone) {
    return {
      success: false,
      message: 'Bill number ya customer ka WhatsApp number batayen taake payment confirm kar sakun.',
    };
  }

  const paymentService = new PaymentService();

  try {
    // Peek first so the reply can honestly say "pehle se paid tha"
    // instead of "abhi paid hua".
    const wasAlreadyPaid = billNo ? (await paymentService.getByBillNo(billNo)).status === 'PAID' : false;

    const payment = billNo
      ? await paymentService.confirmPaymentByBillNo(billNo)
      : await paymentService.confirmLatestPendingForPhone(customerPhone as string);

    const amountText = `Rs. ${formatRupees(payment.amountPaisa)}`;
    const thankYou =
      `Shukriya! Aap ki payment ${amountText} kamyabi se receive ho gayi hai. – Haidar Store ✅\n` +
      `Bill: ${payment.billNo}`;

    try {
      await sendTextMessage(payment.customerPhone, thankYou);
    } catch (error) {
      logger.warn('Thank-you message failed to send', {
        billNo: payment.billNo,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: true,
        billNo: payment.billNo,
        thankYouSent: false,
        message: `Bill ${payment.billNo} PAID mark ho gaya, lekin customer ko shukriya ka message nahi bheja ja saka — unhein zabani bata den.`,
      };
    }

    return {
      success: true,
      billNo: payment.billNo,
      amountRupees: payment.amountPaisa / 100,
      alreadyPaid: wasAlreadyPaid,
      thankYouSent: true,
      message: wasAlreadyPaid
        ? `Bill ${payment.billNo} pehle se PAID tha — customer ko dobara shukriya ka message bhej diya hai.`
        : `Bill ${payment.billNo} (${amountText}) PAID mark ho gaya — customer ko WhatsApp par shukriya ka message bhej diya hai.`,
    };
  } catch (error) {
    if (error instanceof PaymentBillNotFoundError || error instanceof NoPendingPaymentError) {
      return {
        success: false,
        message: `Koi aisa pending bill nahi mila (${billNo ?? customerPhone}). Bill number ya customer ka number dubara check karen.`,
      };
    }
    if (error instanceof PaymentAlreadyCancelledError) {
      return { success: false, message: 'Ye bill CANCELLED hai — isay paid mark nahi kiya ja sakta.' };
    }
    throw error;
  }
}
