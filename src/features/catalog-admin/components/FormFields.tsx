'use client';

import { forwardRef, useId, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * Why this file exists: Select and Textarea, following the exact same
 * label/error/hint pattern as Sprint 1's shared/ui/Input.tsx — but Sprint
 * 1's foundation only built Button/Input/Card/Skeleton/StatusState, and
 * the product form genuinely needs dropdowns (category, status, season)
 * and a multi-line description field. Scoped to this feature
 * (catalog-admin) rather than added to shared/ui, since these two are
 * needed specifically here — if a second feature needs them, promoting
 * them to shared/ui at that point is the right call, not before.
 */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | undefined;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, id, className, children, ...rest }, ref) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'rounded-sm border border-border bg-surface px-3 py-3 text-base text-ink',
          'focus-visible:outline-none focus-visible:border-accent',
          error && 'border-error',
          className,
        )}
        aria-invalid={Boolean(error) || undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? <p role="alert" className="text-xs text-error m-0">{error}</p> : null}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, id, className, ...rest }, ref) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={textareaId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        rows={4}
        className={cn(
          'rounded-sm border border-border bg-surface px-3 py-3 text-base text-ink resize-y',
          'focus-visible:outline-none focus-visible:border-accent',
          error && 'border-error',
          className,
        )}
        aria-invalid={Boolean(error) || undefined}
        {...rest}
      />
      {error ? <p role="alert" className="text-xs text-error m-0">{error}</p> : null}
    </div>
  );
});
