import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';
import { sendTextMessage } from '@/features/whatsapp/client';

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
 * This first version deliberately does NOT yet call any AI or product
 * lookup — it only proves the wiring works (Meta -> this route -> a
 * reply back to the customer's phone), the same "test the plumbing
 * before adding the real logic" step this project has used at every
 * other integration (Neon, Vercel Blob). The actual conversation engine
 * is the very next piece built on top of this.
 *
 * Dependencies: env.ts (WHATSAPP_VERIFY_TOKEN), whatsapp/client.ts.
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
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const payload = await req.json();

  try {
    const message: WhatsAppMessage | undefined =
      payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      // Meta also posts delivery/read "statuses" updates to this same
      // webhook — not an error, just nothing for us to reply to.
      return NextResponse.json({ received: true });
    }

    const customerNumber = message.from;

    logger.info('WhatsApp message received', { from: customerNumber, type: message.type });

    if (message.type === 'text' && message.text) {
      await sendTextMessage(
        customerNumber,
        "Assalam o Alaikum! Haidar Store mein khush aamdeed. Aapka message mil gaya hai — jald hi aapki madad ki jayegi.",
      );
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
