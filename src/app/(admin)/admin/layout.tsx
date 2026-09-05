import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { hasRoleLevel, ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: the admin shell — sidebar nav + the access gate.
 * Server Component, so the RBAC check (`getCurrentUser` + `hasRoleLevel`,
 * both Sprint 1, unchanged) happens before any admin HTML is even sent to
 * the browser — a `staff`-below caller never receives the admin shell at
 * all, not just a client-side-hidden one.
 *
 * This is a real, working gate (redirects to /login), not a decorative
 * one — matching this sprint's "consume the existing APIs, no mock data"
 * spirit applied to auth as well: the panel is genuinely protected by the
 * same session/RBAC system Sprint 1 built, not a fake login screen.
 */

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/brands', label: 'Brands' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/reports', label: 'Reports' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?callbackUrl=/admin');
  }

  if (!hasRoleLevel(user, ROLE_LEVEL.staff)) {
    return (
      <main className="mx-auto max-w-md p-16 text-center">
        <h1 className="text-xl font-semibold text-ink">Access restricted</h1>
        <p className="mt-2 text-sm text-ink-muted">Your account doesn&apos;t have access to the admin panel.</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-surface p-4">
        <p className="mb-6 px-2 text-sm font-semibold text-ink">Haidar Store Admin</p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-sm px-2 py-2 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-border pt-4 px-2 text-xs text-ink-faint">
          Signed in as {user.name} · {user.roleName}
        </div>
      </aside>
      <main className="flex-1 p-6 sm:p-8">{children}</main>
    </div>
  );
}
