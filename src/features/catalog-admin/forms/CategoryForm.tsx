'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Textarea } from '@/features/catalog-admin/components/FormFields';
import { createCategorySchema } from '@/features/catalog';
import { ApiError } from '@/features/catalog-admin/api-client';
import type { CreateCategoryDto } from '@/features/catalog';

/**
 * Why this file exists: the create/edit Category form. Validates
 * client-side with the SAME Zod schema the API uses
 * (`createCategorySchema`, from the barrel — Sprint 2.1) before
 * submitting, so a validation error surfaces instantly rather than only
 * after a round trip; the server still re-validates independently
 * (Sprint 2.3's route layer), this is purely a UX improvement, not the
 * source of truth for validity.
 */

interface CategoryFormProps {
  initialValues?: Partial<CreateCategoryDto>;
  onSubmit: (input: CreateCategoryDto) => Promise<void>;
  onCancel: () => void;
}

export function CategoryForm({ initialValues, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [slug, setSlug] = useState(initialValues?.slug ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = createCategorySchema.safeParse({ name, slug, description: description || undefined, sortOrder: 0 });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
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
      <Input
        label="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        error={errors.slug}
        hint="Lowercase, hyphen-separated (e.g. general-store)"
        required
      />
      <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />

      {formError ? <p className="text-sm text-error">{formError}</p> : null}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Save Category
        </Button>
      </div>
    </form>
  );
}
