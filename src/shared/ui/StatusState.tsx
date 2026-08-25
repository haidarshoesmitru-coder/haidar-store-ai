'use client';

import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';

/**
 * Why this file exists: error and empty states are UI moments, not
 * afterthoughts. This gives every future feature — an empty product
 * list, a failed order fetch, an empty cart — one consistent, accessible
 * pattern: a clear statement of what happened and one clear action, never
 * a bare "Error" or a dead end. Client Component: takes `onAction`
 * callbacks and renders `Button`.
 *
 * Dependencies: Button.
 * Future usage: app/error.tsx uses ErrorState; future empty product
 * grids, empty order histories, etc. use EmptyState.
 */

interface StateProps {
  title: string;
  description?: string | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  icon?: ReactNode;
}

function StatusStateBase({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  variant,
  role,
}: StateProps & { variant: 'primary' | 'secondary'; role?: 'alert' }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-12 px-6 max-w-md mx-auto" role={role}>
      {icon ? <div className="text-ink-faint">{icon}</div> : null}
      <h2 className="text-xl">{title}</h2>
      {description ? <p className="text-ink-muted m-0">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant={variant} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Announced to assistive tech immediately via role="alert" — an error is interruptive by nature. */
export function ErrorState(props: StateProps) {
  return <StatusStateBase {...props} variant="secondary" role="alert" />;
}

/** No alert role — an empty list isn't an interruption, just a state. */
export function EmptyState(props: StateProps) {
  return <StatusStateBase {...props} variant="primary" />;
}
