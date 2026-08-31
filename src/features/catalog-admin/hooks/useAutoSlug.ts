import { useEffect, useRef, useState } from 'react';

/**
 * Why this file exists: three admin forms (Category, Brand, Product) each
 * need a URL-safe, unique-per-record "slug" alongside a human name — the
 * slug can't just be left blank (the database needs a real, unique value
 * for clean URLs and to tell two same-named records apart), but making
 * someone type it by hand every time is needless friction they
 * shouldn't have to think about.
 *
 * `useAutoSlug` solves this: the slug field auto-fills from the name as
 * you type, right up until the moment you edit the slug field yourself —
 * after that, your edit wins and auto-fill stops overwriting it. Same
 * behavior as WordPress/Shopify's slug field, not something invented
 * here.
 *
 * Dependencies: react (useState/useEffect/useRef only).
 * Future usage: CategoryForm.tsx, BrandForm.tsx, ProductForm.tsx.
 */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function useAutoSlug(name: string, initialSlug = ''): [string, (value: string) => void] {
  const [slug, setSlugState] = useState(initialSlug);
  const wasManuallyEdited = useRef(initialSlug !== '');

  useEffect(() => {
    if (!wasManuallyEdited.current) {
      setSlugState(slugify(name));
    }
  }, [name]);

  function setSlug(value: string): void {
    wasManuallyEdited.current = true;
    setSlugState(value);
  }

  return [slug, setSlug];
}
