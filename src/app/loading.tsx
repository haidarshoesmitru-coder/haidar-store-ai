import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * Why this file exists: Next.js App Router convention — automatically
 * shown while this segment (and nested segments without their own
 * loading.tsx) are fetching data, wrapping the segment in a Suspense
 * boundary for us. Uses the shared Skeleton primitive rather than a
 * generic spinner, matching the "shape-matching loading state" decision
 * from shared/ui.
 *
 * Dependencies: Skeleton.tsx.
 * Future usage: template for future route-segment loading.tsx files with
 * more specific skeleton shapes (a product grid skeleton, an order table
 * skeleton) once those features exist.
 */
export default function Loading() {
  return (
    <main className="max-w-2xl mx-auto p-16">
      <Skeleton height="2rem" width="60%" />
      <div className="mt-4">
        <Skeleton height="1rem" />
      </div>
      <div className="mt-2">
        <Skeleton height="1rem" width="80%" />
      </div>
    </main>
  );
}
