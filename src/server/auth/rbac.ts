import { ForbiddenError, UnauthorizedError } from '@/shared/lib/errors';
import type { AuthUser } from '@/features/auth/types';

/**
 * Why this file exists: the API architecture's §6 authorization table
 * (staff < manager < admin, each level includes the ones below) needs one
 * concrete implementation, not a `role === 'admin' || role === 'manager'`
 * check copy-pasted into every future product/order/settings route. This
 * is that implementation.
 *
 * It compares `roleLevel` (a number, seeded in prisma/seed.ts) rather than
 * role names — which is what lets a future role slot into the hierarchy
 * anywhere by picking a level number, without touching this file or any
 * route that calls it.
 *
 * Responsibility: answer "does this user meet the required role level,"
 * and throw the right error (Unauthorized vs Forbidden) if not. Nothing
 * else — it doesn't know about routes, requests, or specific features.
 *
 * Dependencies: errors.ts, features/auth/types.ts.
 * Future usage: api-handler.ts calls `requireRole` when a route is
 * declared with a `requiredRoleLevel` option. Server actions in future
 * feature modules (e.g. `archiveProduct`) call it directly too.
 */

export const ROLE_LEVEL = {
  staff: 10,
  manager: 20,
  admin: 30,
} as const;

export function hasRoleLevel(user: AuthUser, requiredLevel: number): boolean {
  return user.roleLevel >= requiredLevel;
}

/**
 * Throws UnauthorizedError if there's no user at all (not logged in), or
 * ForbiddenError if there is a user but their role isn't high enough —
 * distinct errors on purpose, since a client needs to tell "log in" apart
 * from "you're logged in but not allowed."
 */
export function requireRole(user: AuthUser | null, requiredLevel: number): AuthUser {
  if (!user) {
    throw new UnauthorizedError();
  }
  if (!hasRoleLevel(user, requiredLevel)) {
    throw new ForbiddenError();
  }
  return user;
}
