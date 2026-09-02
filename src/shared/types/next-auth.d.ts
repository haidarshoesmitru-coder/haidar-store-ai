import type { DefaultSession, DefaultUser } from 'next-auth';
import type { JWT as DefaultJWT } from 'next-auth/jwt';

/**
 * Why this file exists: NextAuth's built-in `Session.user` type only has
 * name/email/image. We attach roleName/roleLevel/id in the `session`
 * callback (auth-config.ts) at runtime, but TypeScript has no way to know
 * that unless we declare it here. Without this file, every read of
 * `session.user.roleLevel` elsewhere in the app would silently type as
 * `any` or fail to compile — exactly the kind of gap strict mode exists to
 * catch, so it needs to be closed explicitly.
 *
 * The `User` augmentation exists for the same reason, one layer earlier
 * still: `authorize()` (auth-config.ts) returns an object with
 * roleName/roleLevel, and the `jwt` callback's `user` parameter is typed
 * against this same `User` interface — without declaring the extra
 * fields here, `user.roleName` in the `jwt` callback has no type at all
 * and fails to compile (caught by a full `next build` / `tsc --noEmit`,
 * not by `next dev`'s looser dev-mode checking, which is why this one
 * slipped through locally until Vercel's build caught it).
 *
 * The `next-auth/jwt` augmentation below exists for the same reason, one
 * layer later: the `jwt` callback (auth-config.ts) writes
 * userId/roleName/roleLevel onto the token at sign-in, and the `session`
 * callback reads `token.userId` back out — both sides need this
 * declared, or that read is `any`.
 *
 * Dependencies: next-auth, next-auth/jwt (both type-only).
 * Future usage: read implicitly by every file that imports a `Session`,
 * `User`, or `JWT` type — rbac.ts, session.ts, and auth-config.ts most
 * directly.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roleName: string;
      roleLevel: number;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    roleName: string;
    roleLevel: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userId?: string;
    roleName?: string;
    roleLevel?: number;
  }
}
