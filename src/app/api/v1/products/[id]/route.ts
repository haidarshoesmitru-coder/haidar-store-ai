import { ProductService, updateProductSchema, toProductDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { NotFoundError } from '@/shared/lib/errors';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: GET/PATCH/DELETE for a single Product.
 *
 * GET always returns the cost-safe DTO (`toProductDto`), regardless of
 * caller role — cost/margin visibility for a manager+ caller is exposed
 * at the single-variant granularity instead (see
 * products/[id]/variants/[variantId]/route.ts), matching the access
 * boundary Sprint 2.1 designed (`findById` vs `findByIdForStaff` exists
 * on the variant repository, not the product one). Keeping product
 * detail uniformly safe avoids a second, easily-forgotten cost-inclusive
 * code path on the highest-traffic read endpoint in this module.
 */

const productService = new ProductService();

export const GET = createCatalogRoute<unknown, { id: string }>(async ({ params }) => {
  const id = parseUuidParam(params.id);
  const product = await productService.getById(id);
  if (!product) throw new NotFoundError('Product', id);
  return { data: toProductDto(product), message: 'Product retrieved.' };
});

export const PATCH = createCatalogRoute<unknown, { id: string }>(
  async ({ req, params }) => {
    const id = parseUuidParam(params.id);
    const body = validate(updateProductSchema, await req.json());
    const product = await productService.updateProduct(id, body);
    return { data: toProductDto(product), message: 'Product updated.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);

export const DELETE = createCatalogRoute<unknown, { id: string }>(
  async ({ params }) => {
    const id = parseUuidParam(params.id);
    await productService.archiveProduct(id);
    return { data: null, message: 'Product archived.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.admin },
);
