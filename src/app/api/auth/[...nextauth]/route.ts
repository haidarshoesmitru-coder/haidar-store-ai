import NextAuth from 'next-auth';
import { authConfig } from '@/server/auth/auth-config';

/**
 * Why this file exists: NextAuth's App Router integration requires the
 * config to be mounted at this exact path
 * (`app/api/auth/[...nextauth]/route.ts`) — it's the one file in the
 * codebase that's purely framework wiring, deliberately empty of any
 * logic of its own. All the actual behavior lives in auth-config.ts.
 *
 * Dependencies: next-auth, auth-config.ts.
 * Future usage: not extended — this file's shape is fixed by NextAuth's
 * convention and should stay this thin permanently.
 */
const handler = NextAuth(authConfig);

export { handler as GET, handler as POST };
