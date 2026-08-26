import type { DefaultSession } from 'next-auth';
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
 * The `next-auth/jwt` augmentation below exists for the same reason, one
 * layer earlier: the `jwt` callback (auth-config.ts) writes
 * userId/roleName/roleLevel onto the token at sign-in, and the `session`
 * callback reads `token.userId` back out — both sides need this
 * declared, or that read is `any`.
 *
 * Dependencies: next-auth, next-auth/jwt (both type-only).
 * Future usage: read implicitly by every file that imports a `Session` or
 * `JWT` type — rbac.ts and session.ts most directly.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roleName: string;
      roleLevel: number;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userId?: string;
    roleName?: string;
    roleLevel?: number;
  }
}
