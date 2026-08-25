import { CategoryService, createCategorySchema, categoryListQuerySchema, toCategoryWithSubCategoriesDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseSearchParams } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: GET/POST for the Category collection. Thin by
 * design — every line here is request parsing, a single service call, or
 * mapping the result through a Sprint 2.2 DTO function; zero business
 * logic (that's CategoryService, Sprint 2.2).
 *
 * Every response is mapped through `toCategoryWithSubCategoriesDto`
 * (or the equivalent for other resources) rather than returning the
 * service's raw result — the raw Prisma-shaped object carries internal
 * fields (`deletedAt`) that were never meant to leave the service layer.
 * This is not optional ceremony; skipping it is exactly how internal
 * fields end up in a shipped API response.
 *
 * GET is public (storefront category nav needs no auth). POST requires
 * `manager` per the RBAC table from the API architecture phase
 * ("create/edit products, categories, attributes" = manager+).
 */

const categoryService = new CategoryService();

export const GET = createCatalogRoute(async ({ req }) => {
  parseSearchParams(req, categoryListQuerySchema); // validated, even though this endpoint doesn't paginate — cheap ceremony, consistent contract
  const categories = await categoryService.listForNavigation();
  return { data: categories.map(toCategoryWithSubCategoriesDto), message: 'Categories retrieved.' };
});

export const POST = createCatalogRoute(
  async ({ req }) => {
    const body = validate(createCategorySchema, await req.json());
    const category = await categoryService.createCategory(body);
    return { data: toCategoryWithSubCategoriesDto({ ...category, subCategories: [] }), message: 'Category created.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
