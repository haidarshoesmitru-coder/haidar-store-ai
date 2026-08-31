'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { createBrandSchema } from '@/features/catalog/client';
import { ApiError } from '@/features/catalog-admin/api-client';
import { useAutoSlug } from '@/features/catalog-admin/hooks/useAutoSlug';
import type { CreateBrandDto } from '@/features/catalog/client';

/** Same pattern as CategoryForm.tsx — see there for the shared rationale. */

interface BrandFormProps {
  initialValues?: Partial<CreateBrandDto>;
  onSubmit: (input: CreateBrandDto) => Promise<void>;
  onCancel: () => void;
}

export function BrandForm({ initialValues, onSubmit, onCancel }: BrandFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [slug, setSlug] = useAutoSlug(name, initialValues?.slug ?? '');
  const [logoUrl, setLogoUrl] = useState(initialValues?.logoUrl ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = createBrandSchema.safeParse({ name, slug, logoUrl: logoUrl || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[issue.path.join('.')] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
      <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} error={errors.slug} required />
      <Input label="Logo URL (optional)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} error={errors.logoUrl} />

      {formError ? <p className="text-sm text-error">{formError}</p> : null}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Save Brand
        </Button>
      </div>
    </form>
  );
}
