import { GoogleGenAI } from '@google/genai';
import type { Content } from '@google/genai';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';
import { buildSystemPrompt } from '@/features/ai/system-prompt';
import { searchProducts, searchProductsDeclaration } from '@/features/ai/tools';

/**
 * Why this file exists: the actual "brain" — everything before this
 * (webhook route, WhatsApp client) was pipeline plumbing; this is the
 * first piece that reads what a customer actually wrote and decides how
 * to respond. Deliberately stateless per-message (v1 scope): each
 * incoming message is its own independent conversation with the model —
 * no chat history is persisted or replayed across separate WhatsApp
 * messages yet. That matches the plan's own "just a simple test for now,
 * more features later" scope, and avoids the extra complexity of
 * storing/replaying multi-turn history before the single-turn version is
 * even proven out.
 *
 * The owner/customer distinction happens BEFORE this file even runs —
 * the webhook route decides `isOwner` from the sender's phone number and
 * passes it in. This file just plumbs that flag through to the system
 * prompt (which changes tone/rules) and the tool call (which changes
 * whether cost price is even present in the data the model sees).
 *
 * Model: gemini-2.5-flash-lite — chosen specifically for its free-tier
 * rate limit (highest of the Gemini free models), since a single-shop
 * WhatsApp bot's volume is comfortably within it and this project is
 * intentionally not paying for AI usage yet.
 *
 * Dependencies: @google/genai, env.ts, system-prompt.ts, tools.ts.
 * Future usage: called once per incoming text message from the webhook
 * route. Owner-action tools (record a sale, log an udhaar entry, add
 * stock) get added here later as more function declarations, following
 * the exact same pattern as search_products.
 */

const MODEL = 'gemini-2.5-flash-lite';
const MAX_TOOL_ROUNDS = 3;

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function getAiReply(customerMessage: string, isOwner: boolean): Promise<string> {
  const contents: Content[] = [{ role: 'user', parts: [{ text: customerMessage }] }];
  const systemInstruction = buildSystemPrompt(isOwner, env.SHOP_ADDRESS);
  const tools = [{ functionDeclarations: [searchProductsDeclaration] }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction, tools },
    });

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      return response.text ?? 'Maazrat, is waqt jawab nahi de saka. Dubara koshish karen.';
    }

    // Feed the model's own turn (including its function-call request)
    // back into the conversation before the tool result — the SDK needs
    // this exact turn present to keep its internal reasoning context
    // consistent on the next call.
    const modelTurn = response.candidates?.[0]?.content;
    if (modelTurn) {
      contents.push(modelTurn);
    }

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

      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: call.name, response: { result: toolResult } } }],
      });
    }
  }

  logger.warn('AI conversation hit max tool-call rounds without a final answer');
  return 'Maazrat, is waqt jawab tayyar nahi kar saka. Barah-e-karam dobara poochen ya dukan se raabta karen.';
}
