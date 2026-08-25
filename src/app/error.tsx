'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/shared/ui/StatusState';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: Next.js App Router convention — any error thrown
 * during rendering in this segment (and its children) is caught here
 * instead of taking down the whole app. This is the "Error Boundaries"
 * item from the sprint scope, at the root segment; individual future
 * feature routes can add their own error.tsx for more specific messaging,
 * inheriting this pattern.
 *
 * Note: this runs on the client (required by the Next.js error boundary
 * convention), so it uses the browser-safe subset of `logger` — no direct
 * DB/env access here.
 *
 * Dependencies: StatusState.tsx, logger.ts.
 * Future usage: template for every future route-segment error.tsx (e.g.
 * app/(admin)/admin/error.tsx once the admin module exists).
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Route render error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      description="We hit a snag loading this page. You can try again, or come back in a moment."
      actionLabel="Try again"
      onAction={reset}
    />
  );
}
