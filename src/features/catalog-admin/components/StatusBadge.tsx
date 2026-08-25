import { cn } from '@/shared/utils/cn';

/**
 * Why this file exists: one small, consistent visual treatment for every
 * status-like value in the admin panel (product status, stock level) —
 * color communicates meaning (active/good = accent, draft/neutral = gray,
 * archived/low = warning or error), not decoration.
 */

type Tone = 'neutral' | 'positive' | 'warning' | 'danger';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  positive: 'bg-accent-soft text-accent-hover',
  warning: 'bg-[#fdf3e2] text-warning',
  danger: 'bg-error-soft text-error',
};

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'positive',
  DRAFT: 'neutral',
  ARCHIVED: 'danger',
  INACTIVE: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONE_CLASSES[tone])}>
      {status}
    </span>
  );
}

export function StockBadge({ quantity, threshold }: { quantity: number; threshold: number | null }) {
  const isLow = threshold !== null && quantity <= threshold;
  const tone: Tone = quantity === 0 ? 'danger' : isLow ? 'warning' : 'positive';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONE_CLASSES[tone])}>
      {quantity} in stock
    </span>
  );
}
