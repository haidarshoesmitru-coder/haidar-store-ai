import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * Why this file exists: the single root shell every route renders inside.
 * Global CSS is imported exactly once, here — no other file imports
 * globals.css, which is what prevents duplicate/conflicting global styles
 * as feature modules grow.
 *
 * Dependencies: globals.css.
 * Future usage: will gain a <Providers> wrapper (session provider, etc.)
 * once the storefront/admin shells are built in later sprints — kept out
 * for now since this sprint has no UI-consuming features yet.
 */

export const metadata: Metadata = {
  title: 'Haidar Store',
  description: 'Haidar General & Shoes Store',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
