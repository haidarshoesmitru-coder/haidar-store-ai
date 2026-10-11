import type { Payment } from '@prisma/client';

/**
 * Why this file exists: mirrors orders/types.ts's role for this module —
 * the shared "payment row" shape the repository and service layer pass
 * around. Today it's just the Prisma Payment model (no relations are
 * eagerly loaded); the alias exists so that if relations get included
 * later, only this file changes instead of every signature.
 *
 * Dependencies: @prisma/client (types only).
 * Future usage: payment.repository.ts / .impl.ts, payment.service.ts /
 * .impl.ts, payment.dto.ts.
 */

export type PaymentRecord = Payment;
