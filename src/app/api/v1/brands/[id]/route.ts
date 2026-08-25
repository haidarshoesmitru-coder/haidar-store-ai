import { BrandService, updateBrandSchema, toBrandDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { NotFoundError } from '@/shared/lib/errors';
import { ROLE_LEVEL } from '@/server/auth/rbac';

const brandService = new BrandService();

export const GET = createCatalogRoute<unknown, { id: string }>(async ({ params }) => {
  const id = parseUuidParam(params.id);
  const brand = await brandService.getById(id);
  if (!brand) throw new NotFoundError('Brand', id);
  return { data: toBrandDto(brand), message: 'Brand retrieved.' };
});

export const PATCH = createCatalogRoute<unknown, { id: string }>(
  async ({ req, params }) => {
    const id = parseUuidParam(params.id);
    const body = validate(updateBrandSchema, await req.json());
    const brand = await brandService.updateBrand(id, body);
    return { data: toBrandDto(brand), message: 'Brand updated.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);

export const DELETE = createCatalogRoute<unknown, { id: string }>(
  async ({ params }) => {
    const id = parseUuidParam(params.id);
    await brandService.deleteBrand(id);
    return { data: null, message: 'Brand deleted.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.admin },
);
