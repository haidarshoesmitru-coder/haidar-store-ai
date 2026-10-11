import { z } from 'zod';

/**
 * Why this file exists: the one input shape behind every payment origin —
 * the admin API route today, the WhatsApp AI's create_bill_qr tool today
 * (it validates through this same schema via `validate()`, so the tool
 * and the HTTP route can never disagree on what a valid bill looks like).
 *
 * Amounts enter in whole RUPEES (what a shopkeeper actually says: "1500
 * ka bill") and the service converts to integer paisa for storage —
 * keeping the human-facing unit at the boundary and the machine-safe
 * unit in the database.
 *
 * Dependencies: zod.
 * Future usage: payment.service.impl.ts, the payments API routes, and
 * features/ai/owner-tools.ts (create_bill_qr).
 */

/** Strip spaces, dashes, brackets and a leading '+' — WhatsApp numbers arrive digits-only, humans don't type them that way. */
export function normalizePhoneNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

const phoneSchema = z
  .string()
  .min(7)
  .max(30)
  .transform(normalizePhoneNumber)
  .pipe(
    z.string().regex(/^[0-9]{10,15}$/, 'Customer phone must be 10-15 digits, country code first, no + or spaces.'),
  );

export const createPaymentSchema = z.object({
  amountRupees: z.number().int().positive().max(10_000_000),
  customerPhone: phoneSchema,
  description: z.string().min(1).max(200).optional(),
  orderId: z.string().uuid().optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const confirmPaymentSchema = z.object({
  note: z.string().max(500).optional(),
});
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
