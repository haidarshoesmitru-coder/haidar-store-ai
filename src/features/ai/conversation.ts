import { GoogleGenAI } from '@google/genai';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';
import { buildSystemPrompt } from '@/features/ai/system-prompt';
import { searchProducts, searchProductsDeclaration } from '@/features/ai/tools';

/**
 * Why this file exists: the actual "brain" — everything before this
 * (webhook route, WhatsApp client) was pipeline plumbing; this is the
 * first piece that reads what a customer actually wrote and decides how
 * to respond. Deliberately stateless per-message (v1 scope): each
 * incoming message starts its own fresh `ai.chats` session — no chat
 * history is persisted or replayed across separate WhatsApp messages
 * yet. That matches the plan's own "just a simple test for now, more
 * features later" scope, and avoids the extra complexity of
 * storing/replaying multi-turn history before the single-turn version is
 * even proven out.
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
 * new required model, and swap MODEL to whatever it says.
 *
 * Dependencies: @google/genai, env.ts, system-prompt.ts, tools.ts.
 * Future usage: called once per incoming text message from the webhook
 * route. Owner-action tools (record a sale, log an udhaar entry, add
 * stock) get added here later as more function declarations, following
 * the exact same pattern as search_products.
 */

const MODEL = 'gemini-3.6-flash';
const MAX_TOOL_ROUNDS = 3;

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function getAiReply(customerMessage: string, isOwner: boolean): Promise<string> {
  try {
    return await runConversation(customerMessage, isOwner);
  } catch (error) {
    // A silent failure here means the customer gets NO reply at all —
    // worse than an imperfect one. Whatever goes wrong on Gemini's side
    // (model churn, a 400/404/429, a network hiccup), the customer still
    // gets a plain-language fallback instead of nothing.
    logger.error('AI conversation failed', { error: error instanceof Error ? error.stack : String(error) });
    return isOwner
      ? 'AI se abhi jawab nahi mil saka (technical masla) — thodi dair mein dubara try karen.'
      : 'Maazrat, is waqt jawab tayyar nahi kar saka. Barah-e-karam thodi dair mein dubara poochen ya dukan se raabta karen.';
  }
}

async function runConversation(customerMessage: string, isOwner: boolean): Promise<string> {
  const systemInstruction = buildSystemPrompt(isOwner, env.SHOP_ADDRESS);
  const tools = [{ functionDeclarations: [searchProductsDeclaration] }];

  const chat = ai.chats.create({
    model: MODEL,
    config: { systemInstruction, tools },
  });

  let response = await chat.sendMessage({ message: customerMessage });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      return response.text ?? 'Maazrat, is waqt jawab nahi de saka. Dubara koshish karen.';
    }

    const responseParts = [];
    for (const call of functionCalls) {
      if (!call.name) {
        // The SDK types this as optional; in practice Gemini always
        // names the function it's calling. Skipping defensively rather
        // than sending a nameless functionResponse, which the API
        // itself would reject.
        continue;
      }

      let toolResult: unknown;
      if (call.name === 'search_products') {
        const query = (call.args as { query?: string })?.query ?? '';
        toolResult = await searchProducts(query, isOwner);
      } else {
        toolResult = { error: `Unknown tool: ${call.name}` };
      }

      responseParts.push({ functionResponse: { name: call.name, response: { result: toolResult } } });
    }

    response = await chat.sendMessage({ message: responseParts });
  }

  logger.warn('AI conversation hit max tool-call rounds without a final answer');
  return 'Maazrat, is waqt jawab tayyar nahi kar saka. Barah-e-karam dobara poochen ya dukan se raabta karen.';
}
