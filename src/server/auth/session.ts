import { getServerSession } from 'next-auth';
import { authConfig } from '@/server/auth/auth-config';
import type { AuthUser } from '@/features/auth/types';

/**
 * Why this file exists: keeps `getServerSession(authConfig)` — NextAuth's
 * own API — out of every route handler and server component. Every
 * caller depends on this narrow function instead, which returns the
 * app's own `AuthUser` type, not NextAuth's `Session`. If we ever change
 * auth providers, this is the one function whose internals change; every
 * caller stays the same.
 *
 * Dependencies: next-auth, auth-config.ts, features/auth/types.ts.
 * Future usage: api-handler.ts calls this to resolve the caller for every
 * protected route; rbac.ts consumes its return value.
 */

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authConfig);

  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    roleName: session.user.roleName,
    roleLevel: session.user.roleLevel,
  };
}
