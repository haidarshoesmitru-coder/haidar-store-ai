import { VariantService, createVariantSchema, toVariantDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: GET (list variants for a product) and POST
 * (create a variant under a product) — scoped under `/products/:id/`
 * because a variant's identity is meaningless without its product,
 * matching the nesting decision from the API architecture (§3).
 *
 * GET always returns the cost-safe DTO — same reasoning as the product
 * detail route; a manager+ caller needing cost data uses the single
 * variant route (variants/:variantId), not the list.
 */

const variantService = new VariantService();

export const GET = createCatalogRoute<unknown, { id: string }>(async ({ params }) => {
  const productId = parseUuidParam(params.id);
  const variants = await variantService.getByProduct(productId);
  return { data: variants.map(toVariantDto), message: 'Variants retrieved.' };
});

export const POST = createCatalogRoute<unknown, { id: string }>(
  async ({ req, params }) => {
    const productId = parseUuidParam(params.id);
    const body = validate(createVariantSchema, await req.json());
    const variant = await variantService.createVariant(productId, body);
    return { data: toVariantDto(variant), message: 'Variant created.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
