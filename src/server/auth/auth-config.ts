import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
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
 * Database sessions (not JWT) per the architecture decision: simpler
 * revocation (delete the session row, the user is logged out immediately
 * — a JWT would stay valid until expiry regardless), and this app has a
 * single backend, so JWT's main advantage (stateless verification across
 * multiple services) doesn't apply.
 *
 * Dependencies: next-auth, @auth/prisma-adapter, db.ts, env.ts,
 * AuthService, validation.
 * Future usage: mounted by the NextAuth route handler
 * (app/api/auth/[...nextauth]/route.ts) and read by session.ts.
 */

const authService = new AuthService();

export const authConfig: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'database',
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

        // Shape returned here becomes `user` in the `session` callback below.
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
     * Attaches role info onto the session object NextAuth returns to the
     * server — this is what lets `getCurrentUser()` (session.ts) return a
     * fully-typed AuthUser without an extra DB round trip on every request.
     */
    async session({ session, user }) {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
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
