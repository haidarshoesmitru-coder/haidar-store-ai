import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: every other module that needs to send a WhatsApp
 * message calls `sendTextMessage()` here instead of building the Graph
 * API request itself — one place that knows the endpoint shape, auth
 * header, and error handling, matching the pattern already used for
 * Prisma (db.ts) and NextAuth (auth-config.ts): one thin wrapper around
 * an external system, not scattered fetch calls.
 *
 * v1 scope note: text messages only. The webhook (route.ts, this
 * feature) reads the customer's message and — if it's an image —
 * currently just asks them to describe it in words rather than
 * attempting automatic photo-to-product matching (see webhook route's
 * comment for why that's deliberately out of scope for v1).
 *
 * Dependencies: env.ts (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).
 * Future usage: the webhook route handler, and later the conversation
 * engine once product/price lookups are wired in.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

export async function sendTextMessage(to: string, body: string): Promise<void> {
  const url = `${GRAPH_API_BASE}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('WhatsApp send failed', { to, status: response.status, errorBody });
    throw new Error(`WhatsApp API error (${response.status}): ${errorBody}`);
  }
}
