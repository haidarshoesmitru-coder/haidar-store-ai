'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * Why this file exists: pairs a text input with its label and error
 * message correctly wired via `aria-describedby`/`aria-invalid` — the
 * accessibility requirement from the engineering standards, done once
 * here instead of every future form (login, checkout, product edit)
 * getting it slightly wrong independently. Client Component (`useId`).
 *
 * Dependencies: cn.ts.
 * Future usage: every form field across every future feature.
 */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'font-body text-base px-3 py-3 rounded-sm border border-border bg-surface text-ink',
          'transition-colors focus-visible:outline-none focus-visible:border-accent',
          error && 'border-error',
          className,
        )}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted m-0">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-error m-0">
          {error}
        </p>
      ) : null}
    </div>
  );
});
