import { NextResponse, type NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/server/auth/auth-config';
import { isLoginRateLimited } from '@/server/auth/rate-limit';

/**
 * Why this file exists: NextAuth's App Router integration requires the
 * config to be mounted at this exact path
 * (`app/api/auth/[...nextauth]/route.ts`) — it's the one file in the
 * codebase that's purely framework wiring, deliberately empty of any
 * logic of its own. All the actual behavior lives in auth-config.ts.
 *
 * One deliberate exception to "stays thin": POST is wrapped with a
 * brute-force rate limiter for the credentials sign-in callback (5
 * attempts per IP per 15 minutes, 429 + Retry-After on excess). The
 * limiter lives in server/auth/rate-limit.ts; this file only decides
 * WHEN it applies — sign-in attempts, not signout/session endpoints.
 *
 * Dependencies: next-auth, auth-config.ts, rate-limit.ts.
 * Future usage: not extended — this file's shape is fixed by NextAuth's
 * convention and should stay this thin permanently.
 */
const nextAuthHandler = NextAuth(authConfig);

export function GET(req: NextRequest) {
  return nextAuthHandler(req);
}

export async function POST(req: NextRequest) {
  // Only the credentials sign-in callback needs brute-force protection.
  if (req.nextUrl.pathname.includes('/callback/credentials')) {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const { limited, retryAfterSeconds } = isLoginRateLimited(`login:${ip}`);

    if (limited) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        },
      );
    }
  }

  return nextAuthHandler(req);
}
