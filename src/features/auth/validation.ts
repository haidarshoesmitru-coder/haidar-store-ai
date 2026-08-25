import { z } from 'zod';

/**
 * Why this file exists: demonstrates where validation schemas live —
 * colocated with the feature they validate, not centralized in one giant
 * schemas file that every module would fight over. Every feature module
 * gets its own `validation.ts` following this shape.
 *
 * Dependencies: zod.
 * Future usage: the NextAuth credentials provider (auth-config.ts) parses
 * incoming credentials through this before they ever reach AuthService.
 */

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
