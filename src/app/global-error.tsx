'use client';

/**
 * Why this file exists: error.tsx (above) only catches errors within the
 * page tree — if the root layout itself throws, Next.js falls back to
 * this file instead, which must render its own <html>/<body> since the
 * layout that would normally provide them is what failed. Deliberately
 * plain (inline styles, no design-token CSS import) so it has zero
 * dependency on anything that might also be broken.
 *
 * Dependencies: none — intentionally self-contained.
 * Future usage: not extended; this is a fixed last-resort fallback.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>The application hit an unexpected error. Please try again.</p>
        <button onClick={reset} style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
