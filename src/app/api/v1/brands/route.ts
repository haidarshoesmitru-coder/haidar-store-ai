import { BrandService, createBrandSchema, brandListQuerySchema, toBrandDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseSearchParams } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** See categories/route.ts for the shared rationale (thinness, DTO mapping requirement, RBAC levels). */

const brandService = new BrandService();

export const GET = createCatalogRoute(async ({ req }) => {
  parseSearchParams(req, brandListQuerySchema);
  const brands = await brandService.listActive();
  return { data: brands.map(toBrandDto), message: 'Brands retrieved.' };
});

export const POST = createCatalogRoute(
  async ({ req }) => {
    const body = validate(createBrandSchema, await req.json());
    const brand = await brandService.createBrand(body);
    return { data: toBrandDto(brand), message: 'Brand created.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
