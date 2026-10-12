import { GoogleGenAI } from '@google/genai';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';
import { buildSystemPrompt } from '@/features/ai/system-prompt';
import { searchProducts, searchProductsDeclaration, listCategories, listCategoriesDeclaration } from '@/features/ai/tools';
import { loadHistory, saveExchange } from '@/features/ai/memory';
import {
  addNewStock,
  addNewStockDeclaration,
  recordInShopSale,
  recordInShopSaleDeclaration,
  createNewProduct,
  createNewProductDeclaration,
  createNewCategory,
  createNewCategoryDeclaration,
  createBillQr,
  createBillQrDeclaration,
  confirmPaymentByOwner,
  confirmPaymentDeclaration,
  getTotalAssets,
  getTotalAssetsDeclaration,
} from '@/features/ai/owner-tools';

/**
 * Why this file exists: the actual "brain" — everything before this
 * (webhook route, WhatsApp client) was pipeline plumbing; this is the
 * first piece that reads what a customer actually wrote and decides how
 * to respond. Since v3.4 it has MEMORY: each incoming message replays
 * that WhatsApp number's recent text exchanges as the chat's `history`
 * (see ai/memory.ts), so follow-ups like "wohi wala" resolve — before
 * v3.4 every message started a fresh stateless session and forgot
 * everything.
 *
 * Uses the SDK's `ai.chats` interface (create + sendMessage) rather than
 * calling `ai.models.generateContent` directly with a hand-built
 * `contents` array. This isn't a style preference — Gemini 3 models
 * require a "thought_signature" on every function-call turn, and
 * reconstructing conversation history by hand (as an earlier version of
 * this file did) silently drops it, which the API then rejects with a
 * 400 error. `ai.chats` keeps the full turn history — including that
 * signature — internally, so multi-turn tool calling just works, per
 * Google's own guidance: "If you're using the Google GenAI SDKs, you
 * don't need to manage this process."
 *
 * The owner/customer distinction happens BEFORE this file even runs —
 * the webhook route decides `isOwner` from the sender's phone number and
 * passes it in. This file just plumbs that flag through to the system
 * prompt (which changes tone/rules) and the tool call (which changes
 * whether cost price is even present in the data the model sees).
 *
 * Model: gemini-3.6-flash. This is the THIRD model this file has used —
 * Google keeps narrowing which models new accounts can reach:
 *   1. gemini-2.5-flash-lite → 404, no longer issued to new accounts.
 *   2. gemini-2.5-flash (with thinking disabled, to dodge the Gemini 3.x
 *      thought-signature requirement below) → also 404'd days later.
 *      Google's own error message redirected here.
 *   3. gemini-3.6-flash (current pick) — a GA Gemini 3.x model, so
 *      thinking cannot be disabed and every function call requires a
 *      "thought_signature." Using `ai.chats` (create + sendMessage,
 *      below) rather than hand-built history is the documented way to
 *      let the SDK manage that signature correctly; an earlier attempt
 *      on gemini-3.5-flash-lite still 400'd even through `ai.chats`,
 *      which matches a bug Google has acknowledged in that specific
 *      preview-ish model — the hope is a full GA release (3.6) is more
 *      reliable here. If this same error recurs, that theory is wrong
 *      and the fix needs to go deeper than a model swap.
 *
 * Given how fast this list has moved even within days, expect to revisit
 * this constant again — check Vercel's error logs for a 404 naming the
 * new required model, and swap AI_MODEL to whatever it says.
 *
 * Dependencies: @google/genai, env.ts, system-prompt.ts, tools.ts.
 * Future usage: called once per incoming text message from the webhook
 * route. Owner-action tools (record a sale, log an udhaar entry, add
 * stock) get added here later as more function declarations, following
 * the exact same pattern as search_products.
 */

export const AI_MODEL = 'gemini-3.6-flash';
const MAX_TOOL_ROUNDS = 3;

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * Why this exists: real incident (Oct 12, 2026) — "Shampoo" failed with
 * the generic fallback while "Hi" (no tool call) worked a minute
 * earlier, and the same query had worked the night before. The code
 * path is identical either way, so the failure was transient on
 * Gemini's side (429/5xx/network), not a query bug. Retrying a failed
 * sendMessage with backoff turns those blips into invisible hiccups
 * instead of "samajh nahi aaya" replies. 400/404 are NOT retried —
 * those are bad requests that will fail the same way every time.
 */
function getErrorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.status === 'number') return e.status;
  }
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.match(/\b(400|404|429|500|502|503)\b/);
  return m ? Number(m[1]) : null;
}

async function sendWithRetry<T>(send: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await send();
    } catch (error) {
      lastError = error;
      const status = getErrorStatus(error);
      if (status === 400 || status === 404) throw error;
      if (attempt < 2) {
        logger.warn(`AI ${label} failed, retrying`, { attempt: attempt + 1, status });
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

/**
 * Why this exists: the last line of defense. If the whole Gemini
 * conversation throws (even after retries), a customer asking about a
 * product should still get an answer — the database is right there.
 * This bypasses the LLM entirely: direct category list for browsing
 * questions, direct product search otherwise, formatted in warm Roman
 * Urdu. Returns null when there's genuinely nothing to say, so the
 * caller falls back to the human apology.
 */
async function deterministicFallback(customerMessage: string, isOwner: boolean): Promise<string | null> {
  try {
    const lower = customerMessage.toLowerCase();

    if (isOwner && /(assets|zakat|kul maal)/.test(lower)) {
      const res = (await getTotalAssets()) as { success?: boolean; message?: string };
      if (res?.success && res.message) return res.message;
      return null;
    }

    if (!isOwner && /(kya|kia)\s+(kya|kia)\s+(hai|he)|kya\s+milta|kya\s+available|stock\s+me/.test(lower)) {
      const names = await listCategories();
      if (names.length > 0) {
        return (
          `Bhai hamare paas ye sab milta hai:\n` +
          names.map((n) => `• ${n}`).join('\n') +
          `\nKis cheez ka pooch rahe ho?`
        );
      }
      return null;
    }

    const results = await searchProducts(customerMessage, isOwner);
    if (results.length === 0) return null;
    const lines = results.slice(0, 5).map(
      (r) => `• ${r.productName} — Rs. ${r.price.toLocaleString('en-PK')}${r.inStock ? '' : ' (filhal khatm)'}`,
    );
    return `Bhai ye mile hain:\n${lines.join('\n')}\nAur kuch chahiye tha?`;
  } catch {
    return null;
  }
}

export async function getAiReply(customerMessage: string, isOwner: boolean, senderNumber: string): Promise<string> {
  try {
    return await runConversation(customerMessage, isOwner, senderNumber);
  } catch (error) {
    // A silent failure here means the customer gets NO reply at all —
    // worse than an imperfect one. Whatever goes wrong on Gemini's side
    // (model churn, a 400/404/429, a network hiccup), the customer still
    // gets a plain-language fallback instead of nothing.
    logger.error('AI conversation failed', { error: error instanceof Error ? error.stack : String(error) });
    const direct = await deterministicFallback(customerMessage, isOwner);
    if (direct) return direct;
    return isOwner
      ? 'AI se abhi jawab nahi mil saka (technical masla) — thodi dair mein dubara try karen.'
      : 'Sorry bhai, samajh nahi aaya — zara dobara batayen kya chahiye tha?';
  }
}

async function runConversation(customerMessage: string, isOwner: boolean, senderNumber: string): Promise<string> {
  const systemInstruction = buildSystemPrompt(isOwner, env.SHOP_ADDRESS);
  const functionDeclarations = isOwner
    ? [
        searchProductsDeclaration,
        addNewStockDeclaration,
        recordInShopSaleDeclaration,
        createNewProductDeclaration,
        createNewCategoryDeclaration,
        createBillQrDeclaration,
        confirmPaymentDeclaration,
        getTotalAssetsDeclaration,
      ]
    : [searchProductsDeclaration, listCategoriesDeclaration];
  const tools = [{ functionDeclarations }];

  // v3.4 memory: replay this number's recent TEXT exchanges as the
  // chat's history, oldest-first. loadHistory degrades to [] on any
  // failure, so a memory outage never breaks the reply — and the SDK
  // keeps managing thought_signatures internally across the replayed
  // turns exactly as it does for live ones.
  const history = await loadHistory(senderNumber);

  const chat = ai.chats.create({
    model: AI_MODEL,
    config: { systemInstruction, tools },
    history,
  });

  let response = await sendWithRetry(() => chat.sendMessage({ message: customerMessage }), 'initial reply');
  let finalText: string | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      finalText = response.text ?? 'Sorry bhai, samajh nahi aaya — dobara batayen?';
      break;
    }

    const responseParts: { functionResponse: { name: string; response: { result: unknown } } }[] = [];
    for (const call of functionCalls) {
      if (!call.name) {
        // The SDK types this as optional; in practice Gemini always
        // names the function it's calling. Skipping defensively rather
        // than sending a nameless functionResponse, which the API
        // itself would reject.
        continue;
      }

      const args = call.args as Record<string, unknown>;
      let toolResult: unknown;

      if (call.name === 'search_products') {
        toolResult = await searchProducts((args?.query as string) ?? '', isOwner);
      } else if (call.name === 'list_categories') {
        const names = await listCategories();
        toolResult = { categories: names };
      } else if (call.name === 'add_new_stock' && isOwner) {
        toolResult = await addNewStock(
          (args?.productName as string) ?? '',
          (args?.quantity as number) ?? 0,
          args?.purchasePrice as number | undefined,
          args?.salePrice as number | undefined,
        );
      } else if (call.name === 'record_in_shop_sale' && isOwner) {
        toolResult = await recordInShopSale((args?.productName as string) ?? '', (args?.quantity as number) ?? 0);
      } else if (call.name === 'create_new_product' && isOwner) {
        toolResult = await createNewProduct(
          (args?.productName as string) ?? '',
          (args?.quantity as number) ?? 0,
          (args?.salePrice as number) ?? 0,
          args?.purchasePrice as number | undefined,
          args?.categoryName as string | undefined,
        );
      } else if (call.name === 'create_category' && isOwner) {
        toolResult = await createNewCategory((args?.categoryName as string) ?? '');
      } else if (call.name === 'create_bill_qr' && isOwner) {
        toolResult = await createBillQr(
          (args?.amountRupees as number) ?? 0,
          (args?.customerPhone as string) ?? '',
          args?.description as string | undefined,
        );
      } else if (call.name === 'confirm_payment' && isOwner) {
        toolResult = await confirmPaymentByOwner(
          args?.billNo as string | undefined,
          args?.customerPhone as string | undefined,
        );
      } else if (call.name === 'get_total_assets' && isOwner) {
        toolResult = await getTotalAssets();
      } else {
        // Either an unknown tool name, or a customer's message somehow
        // requested an owner-only tool — the tool list itself already
        // prevents Gemini from being offered these when isOwner is
        // false, but this is the hard backstop in case of any model
        // misbehavior.
        toolResult = { error: `Tool not available: ${call.name}` };
      }

      responseParts.push({ functionResponse: { name: call.name, response: { result: toolResult } } });
    }

    response = await sendWithRetry(() => chat.sendMessage({ message: responseParts }), 'tool follow-up');
  }

  if (finalText === null) {
    logger.warn('AI conversation hit max tool-call rounds without a final answer');
    finalText = 'Bhai ye wala zara samajh nahi aaya — product ka naam dobara batayen?';
  }

  // Persist the TEXT exchange only — never the intermediate
  // functionCalls/functionResponses (see ai/memory.ts for why stale
  // tool results must not replay). saveExchange catches its own
  // errors, so awaiting it here can't break the reply.
  await saveExchange(senderNumber, isOwner, customerMessage, finalText);

  return finalText;
}
