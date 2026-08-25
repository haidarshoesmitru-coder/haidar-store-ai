import type { Config } from 'tailwindcss';

/**
 * Why this file exists: wires Tailwind's utility classes to the same
 * design tokens defined in globals.css, rather than letting Tailwind's
 * *default* palette/spacing scale leak into the app. Colors below are all
 * `var(--color-*)` references — the token values themselves are still
 * defined in exactly one place (globals.css), Tailwind just gets a
 * vocabulary of utility classes on top.
 *
 * Deliberately did NOT redefine spacing/font-size scales here — Tailwind's
 * own spacing/typography scale is used directly (p-4, text-xl, etc.).
 * Sprint 1's first pass defined a parallel --space-* / --text-* scale in
 * CSS; keeping both that and Tailwind's scale would be exactly the
 * duplication the review pass is supposed to catch, so this config
 * standardizes on Tailwind's scale as the single source for spacing/type.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-sunken': 'var(--color-surface-sunken)',
        border: 'var(--color-border)',
        ink: {
          DEFAULT: 'var(--color-ink)',
          muted: 'var(--color-ink-muted)',
          faint: 'var(--color-ink-faint)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          soft: 'var(--color-accent-soft)',
        },
        gold: 'var(--color-gold)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: {
          DEFAULT: 'var(--color-error)',
          soft: 'var(--color-error-soft)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(28, 27, 25, 0.06)',
        md: '0 4px 12px rgba(28, 27, 25, 0.08)',
        lg: '0 12px 32px rgba(28, 27, 25, 0.1)',
      },
      ringColor: {
        accent: 'var(--color-accent)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0 50%' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s ease infinite',
      },
    },
  },
  plugins: [],
};

export default config;
