'use client';

import type { ChangeEvent } from 'react';

/** Search box for the products table — plain input, no extra chrome; debouncing lives in the caller (useDebouncedValue). */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <input
      type="search"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full max-w-sm rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-accent"
      aria-label={placeholder}
    />
  );
}
