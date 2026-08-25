'use client';

import { Button } from '@/shared/ui/Button';

/** Previous/Next controls for the cursor-paginated product table — see useProducts.ts for the cursor-stack approach behind this. */
export function Pagination({
  hasPrevious,
  hasMore,
  onPrevious,
  onNext,
  isLoading,
}: {
  hasPrevious: boolean;
  hasMore: boolean;
  onPrevious: () => void;
  onNext: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
      <Button variant="secondary" size="sm" onClick={onPrevious} disabled={!hasPrevious || isLoading}>
        Previous
      </Button>
      <Button variant="secondary" size="sm" onClick={onNext} disabled={!hasMore || isLoading}>
        Next
      </Button>
    </div>
  );
}
