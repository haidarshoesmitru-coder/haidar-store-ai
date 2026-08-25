import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * Why this file exists: a single, restrained surface treatment (border +
 * a soft shadow, not a glow) so product cards, admin panels, and chat
 * message groups all share one visual language instead of every feature
 * inventing its own box styling. Server Component — no interactivity, no
 * reason to force a client boundary.
 *
 * Dependencies: cn.ts.
 * Future usage: ProductCard, admin dashboard panels, chat message groups —
 * all wrap this rather than styling a raw <div>.
 */

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...rest }: CardProps) {
  return (
    <div
      className={cn('bg-surface border border-border rounded-lg shadow-sm p-6', className)}
      {...rest}
    />
  );
}
