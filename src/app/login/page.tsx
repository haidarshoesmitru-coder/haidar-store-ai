'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Card } from '@/shared/ui/Card';

/**
 * Why this file exists: Sprint 1 built the auth FOUNDATION (NextAuth
 * config, credentials provider, RBAC) but no actual login screen — noted
 * as an open item at the time ("Sprint 2 choice: Catalog module or Auth
 * UI screens"). The admin panel this sprint builds is unusable without
 * one — a real, load-bearing gap, not scope creep, so it's filled here.
 *
 * Uses NextAuth's `signIn('credentials', ...)` client helper directly
 * against Sprint 1's existing credentials provider (`auth-config.ts`) —
 * no new auth logic, just the screen that was missing.
 *
 * Wrapped in Suspense because `useSearchParams()` requires it in the App
 * Router — without this, `next build` fails with "useSearchParams()
 * should be wrapped in a suspense boundary."
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn('credentials', { email, password, redirect: false, callbackUrl });

    if (result?.error) {
      setError('Incorrect email or password.');
      setIsSubmitting(false);
      return;
    }

    window.location.href = callbackUrl;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-ink">Sign in</h1>
        <p className="mb-6 text-sm text-ink-muted">Haidar Store staff &amp; admin access.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <Button type="submit" isLoading={isSubmitting}>Sign in</Button>
        </form>
      </Card>
    </main>
  );
}
