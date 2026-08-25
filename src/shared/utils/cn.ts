import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Why this file exists: `clsx` composes conditional class strings, but on
 * its own it doesn't resolve conflicts — `clsx('p-2', condition && 'p-4')`
 * would emit both classes and let CSS ordering (not intent) decide which
 * wins. `twMerge` resolves that by understanding Tailwind's own utility
 * groups, so the last conflicting class always wins predictably. Every
 * component composes classes through this one function instead of each
 * reimplementing the merge.
 *
 * Dependencies: clsx, tailwind-merge.
 * Future usage: every component in shared/ui and every future feature
 * component that needs conditional or overridable classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
