import { Card } from '@/shared/ui/Card';

/**
 * Why this file exists: Next.js requires a root page to boot the app at
 * all, and this sprint's job is to prove the foundation works end to end
 * (config, styling, shared UI) without building any real feature. This
 * page gets replaced entirely when the Catalog module ships the real
 * storefront home in a later sprint.
 */
export default function HomePage() {
  return (
    <main className="max-w-2xl mx-auto p-16">
      <Card>
        <h1 className="text-2xl mb-2">Haidar Store — Foundation</h1>
        <p className="text-ink-muted m-0">
          Sprint 1 foundation is live. Storefront and admin features ship in later sprints.
        </p>
      </Card>
    </main>
  );
}
