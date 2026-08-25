import { CategoryService, updateCategorySchema, toCategoryDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { NotFoundError } from '@/shared/lib/errors';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: GET/PATCH/DELETE for a single Category. See
 * categories/route.ts for the collection-level rationale, including why
 * every response is mapped through a DTO function rather than returned
 * raw. DELETE requires `admin` per the RBAC table ("archive
 * products/categories" = admin only); PATCH requires `manager`, matching
 * POST on the collection route.
 */

const categoryService = new CategoryService();

export const GET = createCatalogRoute<unknown, { id: string }>(async ({ params }) => {
  const id = parseUuidParam(params.id);
  const category = await categoryService.getById(id);
  if (!category) throw new NotFoundError('Category', id);
  return { data: toCategoryDto(category), message: 'Category retrieved.' };
});

export const PATCH = createCatalogRoute<unknown, { id: string }>(
  async ({ req, params }) => {
    const id = parseUuidParam(params.id);
    const body = validate(updateCategorySchema, await req.json());
    const category = await categoryService.updateCategory(id, body);
    return { data: toCategoryDto(category), message: 'Category updated.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);

export const DELETE = createCatalogRoute<unknown, { id: string }>(
  async ({ params }) => {
    const id = parseUuidParam(params.id);
    await categoryService.deleteCategory(id);
    return { data: null, message: 'Category deleted.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.admin },
);
