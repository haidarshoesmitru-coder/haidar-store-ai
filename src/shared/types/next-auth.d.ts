import type { DefaultSession } from 'next-auth';

/**
 * Why this file exists: NextAuth's built-in `Session.user` type only has
 * name/email/image. We attach roleName/roleLevel/id in the `session`
 * callback (auth-config.ts) at runtime, but TypeScript has no way to know
 * that unless we declare it here. Without this file, every read of
 * `session.user.roleLevel` elsewhere in the app would silently type as
 * `any` or fail to compile — exactly the kind of gap strict mode exists to
 * catch, so it needs to be closed explicitly.
 *
 * Dependencies: next-auth (type-only).
 * Future usage: read implicitly by every file that imports a `Session`
 * type — rbac.ts and session.ts most directly.
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
