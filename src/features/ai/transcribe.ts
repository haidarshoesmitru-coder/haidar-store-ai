import { GoogleGenAI } from '@google/genai';
import { env } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';
import { AI_MODEL } from '@/features/ai/conversation';

/**
 * Why this file exists: turns the owner's WhatsApp voice notes into
 * text so they flow through the EXACT same owner conversation path as
 * typed messages (conversation.ts → getAiReply) — every owner tool
 * (create_bill_qr, confirm_payment, add_new_stock, …) just works, with
 * no parallel voice pipeline to maintain.
 *
 * Model: AI_MODEL, the same gemini-3.6-flash the conversation engine
 * uses (see conversation.ts for the model-churn history). Gemini 3.x
 * flash models accept inline audio; if Google narrows model access
 * again, swap the constant in conversation.ts and this file follows.
 * No new API key: the existing GEMINI_API_KEY is reused.
 *
 * Cost guard: transcription is owner-only — the webhook route checks
 * isOwner BEFORE calling this, so strangers can't burn API budget with
 * voice notes. A voice note from a non-owner never reaches here.
 *
 * Privacy: audio bytes are never logged (not even their length is
 * interesting); only the resulting transcription text flows onward,
 * with the same log visibility as a typed message body.
 *
 * Dependencies: @google/genai, env.ts (GEMINI_API_KEY),
 * ai/conversation.ts (AI_MODEL).
 * Future usage: the webhook route's audio-message branch.
 */

const TRANSCRIPTION_PROMPT = `Transcribe this shop owner's voice note verbatim. He speaks Roman Urdu / Urdu mixed with English product names and numbers (prices, quantities). Output ONLY the transcription, no commentary, no quotation marks. If there is no intelligible speech, output exactly: NO_SPEECH`;

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * Transcribes voice-note audio. Returns the transcription text, or null
 * when there is nothing usable. Never throws for model-side problems —
 * the webhook caller turns null into the Roman-Urdu "samajh nahi aayi"
 * reply, so the owner is never left hanging.
 */
export async function transcribeVoiceNote(audioBytes: Buffer, mimeType: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: [
        { inlineData: { mimeType, data: audioBytes.toString('base64') } },
        { text: TRANSCRIPTION_PROMPT },
      ],
    });

    const text = (response.text ?? '').trim();
    if (!text || text === 'NO_SPEECH') {
      logger.warn('Voice note transcription empty');
      return null;
    }
    logger.info('Voice note transcribed', { chars: text.length });
    return text;
  } catch (error) {
    logger.error('Voice note transcription failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
