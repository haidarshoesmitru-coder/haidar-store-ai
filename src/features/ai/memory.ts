import type { Content } from '@google/genai';
import { db } from '@/shared/lib/db';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: the AI's memory. conversation.ts was stateless
 * per-message until v3.4 — every getAiReply() opened a fresh `ai.chats`
 * session, so follow-ups like "wohi wala" or "us mein 2 aur add kar do"
 * had nothing to resolve against. This module stores the last few TEXT
 * exchanges per WhatsApp number and replays them as the chat's `history`
 * on the next incoming message.
 *
 * TEXT-ONLY HISTORY — the deliberate design decision: we persist the
 * user's text and the assistant's FINAL text reply, and never the
 * intermediate functionCalls / functionResponses. Replaying stale tool
 * results (yesterday's price, yesterday's stock count) would let the
 * model answer from outdated data; a fresh turn re-runs the tools
 * against today's data instead. The cost is that the model can't see
 * its own past tool calls — acceptable, because every turn re-derives
 * them from the current catalog.
 *
 * ROLE MAPPING: the DB stores 'user' | 'assistant' (plain strings, not
 * an enum — the set is fixed by the Gemini Content shape), but the
 * SDK's Content type uses 'user' | 'model'. loadHistory maps
 * 'assistant' -> 'model' on the way out.
 *
 * RESILIENCE: every function here catches its own errors and degrades
 * to stateless — a memory outage (DB hiccup, schema not yet migrated)
 * must never break the reply. Nothing in this file throws to its
 * caller. This matters on day one: the migration may not be applied
 * yet when this code first deploys, and the bot must keep answering.
 *
 * PRIVACY: log lines here carry counts and ids only — never message
 * content and never phone numbers (same rule as the rest of the AI
 * pipeline).
 */

const HISTORY_LIMIT = 12;
const RETENTION_DAYS = 7;

/**
 * Load the last HISTORY_LIMIT text exchanges for a WhatsApp number,
 * oldest-first, in the SDK's Content shape. Returns [] on any failure
 * (degrade to stateless) or when the number has no history yet.
 */
export async function loadHistory(phoneNumber: string): Promise<Content[]> {
  try {
    const conversation = await db.aIConversation.findUnique({
      where: { phoneNumber },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: HISTORY_LIMIT,
        },
      },
    });

    if (!conversation || conversation.messages.length === 0) {
      return [];
    }

    const oldestFirst = [...conversation.messages].reverse();
    logger.info('AI memory history loaded', { messageCount: oldestFirst.length });
    return oldestFirst.map(
      (m): Content => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }),
    );
  } catch (error) {
    // Degrade to stateless — the reply must never depend on memory.
    logger.error('AI memory load failed, continuing stateless', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Persist one completed exchange (user text + final assistant text).
 * Also prunes this conversation's messages older than RETENTION_DAYS —
 * opportunistic cleanup on the write path, so no cron job is needed.
 * Never throws.
 */
export async function saveExchange(
  phoneNumber: string,
  isOwner: boolean,
  userText: string,
  assistantText: string,
): Promise<void> {
  try {
    const conversation = await db.aIConversation.upsert({
      where: { phoneNumber },
      update: { isOwner, lastMessageAt: new Date() },
      create: { phoneNumber, isOwner },
    });

    await db.aIMessage.createMany({
      data: [
        { conversationId: conversation.id, role: 'user', content: userText },
        { conversationId: conversation.id, role: 'assistant', content: assistantText },
      ],
    });

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await db.aIMessage.deleteMany({
      where: { conversationId: conversation.id, createdAt: { lt: cutoff } },
    });

    logger.info('AI memory exchange saved', { messageCount: 2 });
  } catch (error) {
    // The reply was already produced; a failed save must not surface.
    logger.error('AI memory save failed, reply already sent', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
