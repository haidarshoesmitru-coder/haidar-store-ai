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
 * v1 scope note: text messages, plus image messages via sendImageMessage
 * (PNG data URL in, media-upload + image message out — used for bill QR
 * codes). The webhook (route.ts, this feature) reads the customer's
 * message and — if it's an image — currently just asks them to describe
 * it in words rather than attempting automatic photo-to-product matching
 * (see webhook route's comment for why that's deliberately out of scope
 * for v1).
 *
 * Dependencies: env.ts (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).
 * Future usage: the webhook route handler, and later the conversation
 * engine once product/price lookups are wired in.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

function graphHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export async function sendTextMessage(to: string, body: string): Promise<void> {
  const url = `${GRAPH_API_BASE}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: graphHeaders(),
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

/**
 * Send an image message from a PNG data URL (data:image/png;base64,…).
 *
 * Why the two-step dance: the Cloud API's image message takes either a
 * public `link` or an uploaded media `id` — a data URL is neither. So
 * this uploads the bytes to Meta first (uploadImageMedia, below) and
 * then sends the message referencing the returned media id. Both steps
 * throw on failure so the caller can fall back to a text message.
 *
 * Privacy note (audit: no full phone numbers in new logs): failures log
 * the HTTP status and Meta's error body only — never `to`.
 *
 * Dependencies: env.ts (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).
 * Future usage: the create_bill_qr owner tool sends the bill QR this way.
 */
export async function sendImageMessage(to: string, imageDataUrl: string, caption?: string): Promise<void> {
  const mediaId = await uploadImageMedia(imageDataUrl);

  const url = `${GRAPH_API_BASE}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: graphHeaders(),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { id: mediaId, ...(caption ? { caption } : {}) },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('WhatsApp image send failed', { status: response.status, errorBody });
    throw new Error(`WhatsApp API error (${response.status}): ${errorBody}`);
  }
}

/**
 * Upload PNG bytes to Meta's media endpoint; returns the media id for
 * sendImageMessage. Accepts only PNG data URLs — the QR generator always
 * produces those, and restricting the shape here keeps a malformed input
 * from becoming a confusing Meta-side 400.
 */
async function uploadImageMedia(imageDataUrl: string): Promise<string> {
  const match = /^data:image\/png;base64,(.+)$/.exec(imageDataUrl);
  const base64 = match?.[1];
  if (!base64) {
    throw new Error('uploadImageMedia expects a PNG data URL (data:image/png;base64,…)');
  }

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' }), 'qr.png');

  const url = `${GRAPH_API_BASE}/${env.WHATSAPP_PHONE_NUMBER_ID}/media`;
  const response = await fetch(url, {
    method: 'POST',
    // No Content-Type here: fetch sets the multipart boundary itself.
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('WhatsApp media upload failed', { status: response.status, errorBody });
    throw new Error(`WhatsApp media upload error (${response.status}): ${errorBody}`);
  }

  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error('WhatsApp media upload returned no media id');
  }
  return json.id;
}
