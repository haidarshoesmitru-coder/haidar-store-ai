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
 * Model: gemini-3.5-flash-lite — the current free-tier Flash model for
 * new Gemini accounts (Google periodically retires older model IDs for
 * new users; this project started on gemini-2.5-flash-lite, which
 * returned a 404 telling new accounts to switch here). Chosen for the
 * same reason as before: free-tier eligible, and a single-shop
 * WhatsApp bot's volume is comfortably within its rate limits.
 *
 * Dependencies: @google/genai, env.ts, system-prompt.ts, tools.ts.
 * Future usage: called once per incoming text message from the webhook
 * route. Owner-action tools (record a sale, log an udhaar entry, add
 * stock) get added here later as more function declarations, following
 * the exact same pattern as search_products.
 */

const MODEL = 'gemini-3.5-flash-lite';
const MAX_TOOL_ROUNDS = 3;

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function getAiReply(customerMessage: string, isOwner: boolean): Promise<string> {
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
