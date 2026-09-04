import { NextResponse, type NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { getCurrentUser } from '@/server/auth/session';
import { requireRole, ROLE_LEVEL } from '@/server/auth/rbac';
import { ValidationError, isAppError, InternalError } from '@/shared/lib/errors';
import { successBody, errorBody } from '@/features/catalog/api/response';
import { parseUuidParam } from '@/features/catalog/api/query';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: closes the storage gap ImageManager.tsx's and
 * the sibling images/route.ts's comments both explicitly flagged —
 * "no object storage was ever set up." Vercel Blob is the natural
 * choice now specifically because the app is deployed on Vercel: no
 * separate account, no separate API keys to manage beyond the
 * `BLOB_READ_WRITE_TOKEN` Vercel injects automatically once a Blob
 * store is connected to this project (Vercel dashboard → Storage →
 * Create Database → Blob).
 *
 * This route only uploads the file and returns its public URL — it does
 * NOT create the ProductImage row itself. The client (ImageManager.tsx)
 * uploads first, gets the URL back, then calls the existing
 * `POST /images` endpoint with that URL exactly like it already does for
 * a pasted link. That keeps this route single-purpose (file bytes in,
 * URL out) and means the ProductImage-creation logic lives in exactly
 * one place, not duplicated between "pasted URL" and "uploaded file"
 * code paths.
 *
 * Deliberately NOT built on createCatalogRoute (this module's shared
 * route wrapper): that wrapper assumes a JSON request body
 * (`await req.json()`), but file uploads arrive as `multipart/form-data`
 * — different enough at the request-parsing layer to warrant its own
 * thin handler here, reusing the same response/error-shape helpers
 * (successBody/errorBody) so the client sees one consistent contract
 * either way.
 *
 * Dependencies: @vercel/blob, server/auth/session.ts, rbac.ts,
 * shared/lib/errors.ts, catalog/api/response.ts, catalog/api/query.ts.
 * Future usage: ImageManager.tsx's upload button.
 */

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest, context: { params: { id: string } }): Promise<NextResponse> {
  try {
    const currentUser = await getCurrentUser();
    requireRole(currentUser, ROLE_LEVEL.manager);

    const productId = parseUuidParam(context.params.id);

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new ValidationError('No file was provided.', [{ field: 'file', issue: 'Expected a file upload.' }]);
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new ValidationError('Unsupported file type.', [
        { field: 'file', issue: 'Only JPEG, PNG, WEBP, or GIF images are accepted.' },
      ]);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError('File is too large.', [{ field: 'file', issue: 'Maximum size is 5 MB.' }]);
    }

    const extension = file.name.split('.').pop() ?? 'jpg';
    const blob = await put(`product-images/${productId}/${crypto.randomUUID()}.${extension}`, file, {
      access: 'public',
    });

    logger.info('Product image uploaded', { productId, url: blob.url });

    return NextResponse.json(successBody({ url: blob.url }, 'Image uploaded.'), { status: 201 });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(errorBody(error), { status: error.httpStatus });
    }
    logger.error('Image upload failed', { error: error instanceof Error ? error.stack : String(error) });
    const internalError = new InternalError();
    return NextResponse.json(errorBody(internalError), { status: internalError.httpStatus });
  }
}
