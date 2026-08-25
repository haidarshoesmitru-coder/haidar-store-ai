import { ProductService, productImageInputSchema } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: POST for adding a product image — new in Sprint
 * 2.4. `ProductService.addImage` has existed since Sprint 2.2, but Sprint
 * 2.3 never exposed it over HTTP (its endpoint list didn't include
 * images). Filling that gap, not redesigning anything — this route is as
 * thin as every other one in this module: validate, call one service
 * method, return the result.
 *
 * `url` is a real, working field (Sprint 2.1's `ProductImage.url` is just
 * a string) — the admin panel supplies it via a URL-entry field rather
 * than a file-upload widget, since no object storage (S3/R2) was set up
 * in any prior sprint. This is the "placeholder storage integration"
 * explicitly permitted by this sprint's task, chosen because it's the
 * most honest option: it produces real, persisted, non-mock data through
 * the real API, rather than a file picker that has nowhere real to
 * upload to.
 */

const productService = new ProductService();

export const POST = createCatalogRoute<unknown, { id: string }>(
  async ({ req, params }) => {
    const productId = parseUuidParam(params.id);
    const body = validate(productImageInputSchema, await req.json());
    const image = await productService.addImage(productId, body);
    return { data: image, message: 'Image added.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
