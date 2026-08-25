import { VariantService, updateVariantSchema, toVariantDto, toVariantWithCostDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { hasRoleLevel, ROLE_LEVEL } from '@/server/auth/rbac';
import { NotFoundError } from '@/shared/lib/errors';

/**
 * Why this file exists: GET/PATCH/DELETE for a single ProductVariant.
 *
 * GET is the ONE place in this API where cost/margin data can be
 * returned — and only when the authenticated caller's role is manager+.
 * This is the exact split Sprint 2.1 designed into the repository
 * interface (`findById` vs `findByIdForStaff`); this route is where that
 * split actually gets exercised based on who's asking. GET itself has no
 * `requiredRoleLevel` (any authenticated-or-anonymous caller can view a
 * variant), but the ROLE-DEPENDENT BRANCH inside the handler decides
 * whether cost is included — a public storefront call and a manager's
 * admin-panel call hit the same endpoint and get different (both
 * correct) shapes.
 */

const variantService = new VariantService();

export const GET = createCatalogRoute<unknown, { id: string; variantId: string }>(async ({ params, user }) => {
  const variantId = parseUuidParam(params.variantId);

  if (user && hasRoleLevel(user, ROLE_LEVEL.manager)) {
    const variant = await variantService.getByIdForStaff(variantId);
    if (!variant) throw new NotFoundError('ProductVariant', variantId);
    return { data: toVariantWithCostDto(variant), message: 'Variant retrieved.' };
  }

  const variant = await variantService.getById(variantId);
  if (!variant) throw new NotFoundError('ProductVariant', variantId);
  return { data: toVariantDto(variant), message: 'Variant retrieved.' };
});

export const PATCH = createCatalogRoute<unknown, { id: string; variantId: string }>(
  async ({ req, params }) => {
    const variantId = parseUuidParam(params.variantId);
    const body = validate(updateVariantSchema, await req.json());
    const variant = await variantService.updateVariant(variantId, body);
    return { data: toVariantWithCostDto(variant), message: 'Variant updated.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager }, // PATCH already requires manager+, so the cost-inclusive DTO here is safe
);

export const DELETE = createCatalogRoute<unknown, { id: string; variantId: string }>(
  async ({ params }) => {
    const variantId = parseUuidParam(params.variantId);
    await variantService.deleteVariant(variantId);
    return { data: null, message: 'Variant deleted.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.admin },
);
