'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import type { ProductImageDto } from '@/features/catalog';

/**
 * Why this file exists: multi-image management for a product — preview,
 * add, remove, set featured, reorder — built against the real
 * `/api/v1/products/:id/images` endpoints added this sprint.
 *
 * No file-upload widget: no object storage (S3/R2) was ever set up in
 * any prior sprint, and `ProductImage.url` (Sprint 2.1) is just a string
 * — so images are added by URL (an admin pastes a link to an
 * already-hosted image). This is the "placeholder storage integration"
 * this sprint's task explicitly permits, chosen because it's honest: it
 * produces real, persisted, non-mock `ProductImage` rows through the real
 * API, rather than a file picker with nowhere real to send bytes.
 *
 * Reorder/set-featured are implemented as remove-then-re-add — the only
 * two operations the API actually exposes (there's no PATCH-image
 * endpoint). `rewriteAll` is the one place that logic lives: it removes
 * every existing image and re-adds them in the desired order/flags, in
 * sequence. Flagged as a real limitation: each operation generates new
 * image `id`s rather than updating in place, and a burst of remove+add
 * calls is not atomic (a failure mid-sequence can leave images
 * temporarily inconsistent — acceptable for an admin tool used by one
 * operator at a time, not for a high-concurrency public write path). A
 * future `PATCH /images/:id` endpoint would remove the need for this
 * entirely.
 */

interface ImageManagerProps {
  images: ProductImageDto[];
  onAdd: (url: string, isPrimary: boolean, sortOrder: number) => Promise<void>;
  onRemove: (imageId: string) => Promise<void>;
}

export function ImageManager({ images, onAdd, onRemove }: ImageManagerProps) {
  const [newUrl, setNewUrl] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  async function rewriteAll(next: { url: string; altText: string | null; isPrimary: boolean }[]) {
    setIsBusy(true);
    setError(null);
    try {
      for (const image of sorted) {
        await onRemove(image.id);
      }
      for (const [index, image] of next.entries()) {
        await onAdd(image.url, image.isPrimary, index);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update images.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAdd() {
    if (!newUrl.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      await onAdd(newUrl.trim(), images.length === 0, images.length);
      setNewUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add image.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemove(imageId: string) {
    setIsBusy(true);
    setError(null);
    try {
      await onRemove(imageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove image.');
    } finally {
      setIsBusy(false);
    }
  }

  function handleSetFeatured(targetId: string) {
    return rewriteAll(
      sorted.map((image) => ({ url: image.url, altText: image.altText, isPrimary: image.id === targetId })),
    );
  }

  function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);
    return rewriteAll(reordered.map((image) => ({ url: image.url, altText: image.altText, isPrimary: image.isPrimary })));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Image URL"
            placeholder="https://..."
            value={newUrl}
            onChange={(event) => setNewUrl(event.target.value)}
            hint="No file storage is connected yet — paste a link to an already-hosted image."
          />
        </div>
        <Button onClick={handleAdd} isLoading={isBusy} disabled={!newUrl.trim()}>
          Add Image
        </Button>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      {sorted.length === 0 ? (
        <p className="text-sm text-ink-muted">No images yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sorted.map((image, index) => (
            <div key={image.id} className="relative rounded-md border border-border overflow-hidden bg-surface-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element -- external, arbitrary admin-supplied URLs; next/image's domain allowlist doesn't fit a "paste any URL" field */}
              <img src={image.url} alt={image.altText ?? ''} className="h-28 w-full object-cover" />
              {image.isPrimary ? (
                <span className="absolute left-1 top-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                  Featured
                </span>
              ) : null}
              <div className="flex items-center justify-between gap-1 p-1.5">
                <button
                  type="button"
                  onClick={() => handleMove(index, -1)}
                  disabled={isBusy || index === 0}
                  className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
                  aria-label="Move earlier"
                >
                  ←
                </button>
                {!image.isPrimary ? (
                  <button
                    type="button"
                    onClick={() => handleSetFeatured(image.id)}
                    disabled={isBusy}
                    className="text-xs text-accent hover:text-accent-hover"
                  >
                    Set featured
                  </button>
                ) : (
                  <span className="text-xs text-ink-faint">—</span>
                )}
                <button
                  type="button"
                  onClick={() => handleMove(index, 1)}
                  disabled={isBusy || index === sorted.length - 1}
                  className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
                  aria-label="Move later"
                >
                  →
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(image.id)}
                disabled={isBusy}
                className="absolute right-1 top-1 rounded-full bg-ink/60 px-1.5 text-xs text-white hover:bg-error"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
