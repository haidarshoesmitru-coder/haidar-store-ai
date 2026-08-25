import { cn } from '@/shared/utils/cn';

/**
 * Why this file exists: a shape-matching loading placeholder (a gently
 * shimmering block sized to the content it stands in for) reads as more
 * intentional than a centered spinner, and it's what the app's
 * loading.tsx boundaries and future list views (product grid, order
 * table) use while data streams in. Server Component — purely visual, no
 * interactivity.
 *
 * The shimmer gradient uses arbitrary Tailwind values rather than a new
 * config token, since it's a one-off effect specific to this component,
 * not a reusable design decision worth promoting into the shared palette.
 *
 * Dependencies: cn.ts. The `shimmer` keyframe/animation is defined once in
 * tailwind.config.ts.
 * Future usage: app/loading.tsx today; product grids, order tables, etc.
 * in later sprints.
 */

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export function Skeleton({ width = '100%', height = '1rem', className, rounded = 'sm' }: SkeletonProps) {
  return (
    <span
      className={cn(
        'inline-block bg-[length:400%_100%] animate-shimmer',
        'bg-gradient-to-r from-surface-sunken via-border to-surface-sunken',
        ROUNDED[rounded],
        className,
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
