import { ProductService } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseUuidParam } from '@/features/catalog/api/query';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/** DELETE for removing a product image — see images/route.ts for the shared rationale. */

const productService = new ProductService();

export const DELETE = createCatalogRoute<unknown, { id: string; imageId: string }>(
  async ({ params }) => {
    const productId = parseUuidParam(params.id);
    const imageId = parseUuidParam(params.imageId);
    await productService.removeImage(productId, imageId);
    return { data: null, message: 'Image removed.' };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
