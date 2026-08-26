import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/shared/lib/db';
import { env } from '@/shared/config/env';
import { AuthService } from '@/features/auth/services/auth.service';
import { loginSchema } from '@/features/auth/validation';
import { validate } from '@/shared/validation/validate';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: NextAuth needs its config in a specific shape
 * (`NextAuthOptions`) that the framework understands. This file is the
 * ONLY place that shape exists — it translates between NextAuth's
 * conventions and our AuthService, and nowhere else in the codebase talks
 * to NextAuth directly except the route handler that mounts it and
 * session.ts (below), which reads the result.
 *
 * JWT sessions, not database — NextAuth's CredentialsProvider only
 * supports the `jwt` strategy (`database` strategy requires an adapter to
 * persist a session row keyed off a provider-created Account, which
 * Credentials intentionally never creates — there's no OAuth account to
 * link). This was originally written as `database` for simpler
 * revocation, but that combination doesn't actually work with
 * CredentialsProvider at all (NextAuth throws
 * UnsupportedStrategyError at request time) — not a style choice to
 * revisit later, a hard framework constraint. No PrismaAdapter either,
 * for the same reason: it exists to persist OAuth accounts/sessions,
 * neither of which this Credentials-only setup has.
 *
 * Dependencies: next-auth, db.ts, env.ts, AuthService, validation.
 * Future usage: mounted by the NextAuth route handler
 * (app/api/auth/[...nextauth]/route.ts) and read by session.ts.
 */

const authService = new AuthService();

export const authConfig: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days for customer-facing sessions
    updateAge: 24 * 60 * 60,
  },
  secret: env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        // NextAuth hands us untyped input — validated the same way any
        // other feature's input is validated, no special-casing.
        const credentials = validate(loginSchema, rawCredentials);
        const user = await authService.verifyCredentials(credentials);

        if (!user) {
          // NextAuth expects `null`, not a thrown error, for "invalid
          // credentials" — matches the enumeration-safety decision made
          // in AuthService.
          return null;
        }

        logger.info('User authenticated', { userId: user.id });

        // Shape returned here becomes `user` in the `jwt` callback below,
        // on sign-in only (not on subsequent token refreshes).
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roleName: user.roleName,
          roleLevel: user.roleLevel,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Runs on sign-in (with `user` populated from `authorize` above) and
     * on every subsequent request that reads the session (with `user`
     * undefined) — role info is persisted into the JWT itself at
     * sign-in, so later calls don't need a DB round trip just to read
     * role/level.
     */
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.roleName = user.roleName;
        token.roleLevel = user.roleLevel;
      }
      return token;
    },

    /**
     * Attaches role info from the JWT onto the session object the server
     * sees — this is what lets `getCurrentUser()` (session.ts) return a
     * fully-typed AuthUser. A fresh DB read (rather than trusting the
     * token's role fields verbatim) so a role change takes effect on the
     * user's very next request instead of waiting up to `updateAge` for
     * the token to refresh — the DB round trip the JWT approach was
     * meant to avoid is deliberately paid back here, once per session
     * read, specifically for role/level, since a stale permission level
     * is a correctness issue in a way a stale name/email is not.
     */
    async session({ session, token }) {
      const dbUser = await db.user.findUnique({
        where: { id: token.userId as string },
        include: { role: true },
      });

      if (dbUser) {
        session.user = {
          ...session.user,
          id: dbUser.id,
          roleName: dbUser.role.name,
          roleLevel: dbUser.role.level,
        };
      }

      return session;
    },
  },
};
