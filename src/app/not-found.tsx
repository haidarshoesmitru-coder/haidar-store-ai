import Link from 'next/link';

/**
 * Why this file exists: Next.js convention for unmatched routes.
 *
 * Deliberately NOT built on EmptyState here: EmptyState is a Client
 * Component that takes an `onAction` callback, and a Server Component
 * (this file) cannot pass a plain closure into a Client Component's props
 * — only serializable data or Server Actions can cross that boundary.
 * Rather than force this page to be a Client Component just to reuse a
 * shared primitive, it's composed directly with the same visual language
 * (Tailwind utility classes matching the rest of the app) applied
 * directly. Reaching for a shared component isn't free if it forces an
 * unnecessary client boundary on a page with no interactivity.
 *
 * Dependencies: next/link only.
 */
export default function NotFound() {
  return (
    <main className="flex flex-col items-center text-center gap-3 py-16 px-6 max-w-md mx-auto">
      <h1 className="text-xl">Page not found</h1>
      <p className="text-ink-muted m-0">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className="text-accent font-semibold hover:text-accent-hover">
        Return to homepage
      </Link>
    </main>
  );
}
