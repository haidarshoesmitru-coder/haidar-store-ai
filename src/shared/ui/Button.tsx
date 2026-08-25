'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * Why this file exists: the "Shared UI Components" item, concretely.
 * Every future feature (product "Add to cart," admin "Save," AI chat
 * "Send") uses this instead of a raw <button>, so variant styling,
 * disabled states, and focus handling are defined once. Client Component
 * because it forwards event handlers from callers.
 *
 * Dependencies: cn.ts (Tailwind class composition).
 * Future usage: everywhere an action is triggered, across every future
 * feature module.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-body font-semibold rounded-md ' +
  'border border-transparent whitespace-nowrap transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-55 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1';

const SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-2',
  md: 'text-base px-4 py-3',
  lg: 'text-lg px-6 py-3',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border-border hover:bg-surface-sunken',
  ghost: 'bg-transparent text-ink hover:bg-surface-sunken',
  danger: 'bg-error text-white hover:opacity-90',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BASE, SIZE[size], VARIANT[variant], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? (
        <span
          className="h-[1em] w-[1em] rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      ) : null}
      <span className={isLoading ? 'opacity-0' : undefined}>{children}</span>
    </button>
  );
});
