import { z } from 'zod';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: downloading Meta-hosted media — the two-step
 * dance the Cloud API requires: first GET /{media-id} for a temporary
 * download URL, then GET the bytes. Kept separate from client.ts (which
 * only SENDS messages/media) so download concerns — size caps,
 * mime-type allow-listing — live in one place.
 *
 * v3.3 scope: voice notes only. The webhook route calls
 * downloadVoiceNote() for incoming audio messages; the bytes go to
 * ai/transcribe.ts, never to disk, never to logs.
 *
 * Security notes:
 * - Size is capped twice: Meta's declared `file_size` (advisory — may be
 *   absent) AND the actual downloaded bytes. A lying header can't blow
 *   up memory.
 * - Only `audio/*` is accepted. A forged webhook can't smuggle an
 *   executable through here (and the HMAC gate in route.ts rejects
 *   forged webhooks before this is ever reached anyway).
 * - Logs carry byte counts and mime types only — never the media URL
 *   (it embeds a token-ish signature) and never the sender's number.
 *
 * Dependencies: env.ts (WHATSAPP_ACCESS_TOKEN).
 * Future usage: image-message download if visual product matching is
 * ever built (would need its own mime allow-list).
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/** WhatsApp voice notes are tiny; 8MB is a generous ceiling. */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const mediaInfoSchema = z.object({
  url: z.string().url(),
  mime_type: z.string().optional(),
  file_size: z.number().int().nonnegative().optional(),
});

export interface DownloadedAudio {
  bytes: Buffer;
  mimeType: string;
}

function bearerHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` };
}

/**
 * Downloads a WhatsApp voice note by its Meta media id.
 * Throws on any failure — the caller (webhook route) turns that into
 * the "samajh nahi aayi" reply.
 */
export async function downloadVoiceNote(mediaId: string): Promise<DownloadedAudio> {
  // Step 1: resolve the media id to a temporary download URL.
  const infoResponse = await fetch(`${GRAPH_API_BASE}/${mediaId}`, { headers: bearerHeaders() });
  if (!infoResponse.ok) {
    const errorBody = await infoResponse.text();
    logger.error('WhatsApp media info fetch failed', { status: infoResponse.status, errorBody });
    throw new Error(`WhatsApp media info error (${infoResponse.status})`);
  }
  const info = mediaInfoSchema.parse(await infoResponse.json());

  // Declared size is advisory (Meta may omit it) — enforced again on
  // the real bytes below.
  if (info.file_size !== undefined && info.file_size > MAX_AUDIO_BYTES) {
    logger.warn('WhatsApp voice note rejected: declared size over cap', { fileSize: info.file_size });
    throw new Error('Voice note too large');
  }

  // Step 2: download the bytes. The same bearer token authorizes the
  // CDN URL.
  const bytesResponse = await fetch(info.url, { headers: bearerHeaders() });
  if (!bytesResponse.ok) {
    logger.error('WhatsApp media download failed', { status: bytesResponse.status });
    throw new Error(`WhatsApp media download error (${bytesResponse.status})`);
  }

  // Trust the actual bytes' content-type over the declared one.
  const contentType = bytesResponse.headers.get('content-type') ?? info.mime_type ?? '';
  const mimeType = (contentType.split(';')[0] ?? '').trim().toLowerCase();
  if (!mimeType.startsWith('audio/')) {
    logger.warn('WhatsApp voice note rejected: not audio', { mimeType });
    throw new Error('Voice note is not audio');
  }

  const buffer = Buffer.from(await bytesResponse.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error('Voice note download was empty');
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    logger.warn('WhatsApp voice note rejected: actual size over cap', { bytes: buffer.length });
    throw new Error('Voice note too large');
  }

  logger.info('WhatsApp voice note downloaded', { bytes: buffer.length, mimeType });
  return { bytes: buffer, mimeType };
}
