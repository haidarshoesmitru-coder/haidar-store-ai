import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';
import { sendTextMessage } from '@/features/whatsapp/client';
import { downloadVoiceNote } from '@/features/whatsapp/media';
import { getAiReply } from '@/features/ai/conversation';
import { transcribeVoiceNote } from '@/features/ai/transcribe';

/**
 * Why this file exists: the single entry point Meta calls for everything
 * WhatsApp-related — the one-time webhook verification handshake (GET)
 * and every incoming customer message thereafter (POST). Kept as a
 * standalone route (not wrapped in createCatalogRoute/createOrderRoute)
 * because this endpoint is called by Meta's servers, not our own admin
 * UI — there's no logged-in user, no session, and the "auth" here is the
 * verify token / a future signature check, not NextAuth.
 *
 * v1 scope, matching the plan: no order-taking yet (that's a later
 * feature — for now the AI tells a customer who wants to order to visit
 * the shop, with the address). No image-based product matching yet
 * either: WhatsApp gives us the image's Meta-hosted media ID, and
 * matching that reliably against a specific catalog product needs a
 * dedicated visual-search step this sprint intentionally doesn't build —
 * attempting a guess and stating it as fact risks telling a customer the
 * wrong product is or isn't in stock, which is worse than asking them to
 * describe it in words instead.
 *
 * Owner recognition happens right here, before the AI is ever called:
 * the sender's number is checked against `OWNER_WHATSAPP_NUMBERS`
 * (env.ts, comma-separated — the shop has more than one admin number).
 * This is the hard, code-level check the business rule requires — "is
 * this an owner/admin" is decided by this comparison, never by asking
 * the AI to infer it from what the message says.
 *
 * v3.3: voice notes. An incoming `audio` message from an owner number
 * is downloaded (whatsapp/media.ts: size-capped, audio/* only) and
 * transcribed with the existing Gemini client (ai/transcribe.ts), then
 * the text goes through the same getAiReply owner path as a typed
 * message — every owner tool works for voice with zero changes. Voice
 * notes from non-owners are NOT transcribed (cost guard); they get a
 * polite "please type it" reply instead.
 *
 * POST requests are authenticated with Meta's HMAC-SHA256 signature
 * (`X-Hub-Signature-256` header, keyed with WHATSAPP_APP_SECRET) BEFORE
 * any processing. This is load-bearing, not optional: `isOwner` is
 * derived from the unsigned `from` field, so without signature
 * verification an attacker who guesses this URL could forge a webhook
 * from an owner number and reach owner-only tools (cost prices, stock
 * writes, sale recording).
 *
 * Dependencies: env.ts (WHATSAPP_VERIFY_TOKEN, OWNER_WHATSAPP_NUMBERS),
 * whatsapp/client.ts, ai/conversation.ts.
 * Future usage: this is the one URL entered into Meta's App Dashboard
 * (Configuration -> Webhook). Meta will re-call the GET handler if the
 * subscription is ever re-verified.
 */

export function GET(req: NextRequest): NextResponse {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
    logger.info('WhatsApp webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('WhatsApp webhook verification failed', { mode, tokenMatched: token === env.WHATSAPP_VERIFY_TOKEN });
  return new NextResponse('Forbidden', { status: 403 });
}

interface WhatsAppMessage {
  from: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type?: string };
}

/**
 * Verifies Meta's HMAC-SHA256 signature of the raw request body against
 * the app secret. Uses a timing-safe comparison so an attacker can't
 * learn the secret byte-by-byte from response-time differences.
 */
function isValidWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody, 'utf8').digest('hex')}`;
  const received = Buffer.from(signatureHeader, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

/**
 * Voice-note path (v3.3, owner-only): download the audio, transcribe it
 * with the existing Gemini client, then feed the text through the SAME
 * getAiReply owner path as a typed message — so every owner tool
 * (create_bill_qr, confirm_payment, add_new_stock, …) works unchanged.
 *
 * A voice note from a non-owner never gets transcribed (that would let
 * strangers burn API budget): they get a polite text-only nudge
 * instead. This is a deliberate v1 boundary, documented as a known
 * limitation.
 *
 * Any failure — download, transcription, or an empty result — gets the
 * Roman-Urdu "didn't catch that" reply, never silence and never a
 * stack trace. Audio bytes are never logged anywhere on this path.
 */
async function handleVoiceNote(senderNumber: string, isOwner: boolean, mediaId: string): Promise<void> {
  if (!isOwner) {
    await sendTextMessage(
      senderNumber,
      'Voice note ka shukriya! Barah-e-karam apna paigham likh kar bhejen taake main foran jawab de sakun.',
    );
    return;
  }

  try {
    const { bytes, mimeType } = await downloadVoiceNote(mediaId);
    const transcription = await transcribeVoiceNote(bytes, mimeType);
    if (!transcription) {
      throw new Error('empty transcription');
    }
    // Same path as typed text — isOwner=true keeps owner tools available.
    // The transcription text is logged here only (never audio bytes,
    // never the sender's number).
    logger.info('Voice note routed to owner AI', { chars: transcription.length });
    const reply = await getAiReply(transcription, true, senderNumber);
    await sendTextMessage(senderNumber, reply);
  } catch (error) {
    logger.error('Voice note handling failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendTextMessage(
      senderNumber,
      'Voice note samajh nahi aayi — barah-e-karam dobara bhejen ya likh kar bhej den.',
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read the RAW body: signature verification must run over the exact
  // bytes Meta signed, before JSON parsing. `req.json()` would consume
  // the stream and lose the original byte sequence.
  const rawBody = await req.text();

  if (!isValidWebhookSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    // 401, not the catch-all 200 below: a forged request must be
    // rejected outright, never processed. (The 200-always policy exists
    // so Meta doesn't disable the webhook over OUR bugs — it doesn't
    // apply to requests that were never from Meta.)
    logger.warn('WhatsApp webhook signature verification failed');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let payload: {
    entry?: Array<{ changes?: Array<{ value?: { messages?: WhatsAppMessage[] } }> }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  try {
    const message: WhatsAppMessage | undefined =
      payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      // Meta also posts delivery/read "statuses" updates to this same
      // webhook — not an error, just nothing for us to reply to.
      return NextResponse.json({ received: true });
    }

    const customerNumber = message.from;
    const ownerNumbers = env.OWNER_WHATSAPP_NUMBERS.split(',').map((n) => n.trim());
    const isOwner = ownerNumbers.includes(customerNumber);

    logger.info('WhatsApp message received', { from: customerNumber, type: message.type, isOwner });

    if (message.type === 'text' && message.text) {
      const reply = await getAiReply(message.text.body, isOwner, customerNumber);
      await sendTextMessage(customerNumber, reply);
    } else if (message.type === 'audio' && message.audio?.id) {
      await handleVoiceNote(customerNumber, isOwner, message.audio.id);
    } else if (message.type === 'image') {
      await sendTextMessage(
        customerNumber,
        'Tasveer mil gayi hai — barah-e-karam bata den ye kaunsi product hai (naam ya tafseel), taake stock aur price check kar sakein.',
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Always 200: Meta retries (and eventually disables) a webhook that
    // returns errors, so a failure on our side (a bug, WhatsApp API
    // hiccup) should be logged, not surfaced as a webhook failure to
    // Meta.
    logger.error('WhatsApp webhook processing failed', {
      error: error instanceof Error ? error.stack : String(error),
    });
    return NextResponse.json({ received: true });
  }
}
