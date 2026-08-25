import { ProductService, ProductSearchService, createProductSchema, productSearchQuerySchema, toProductDto } from '@/features/catalog';
import { createCatalogRoute } from '@/features/catalog/api/handler';
import { parseSearchParams } from '@/features/catalog/api/query';
import { validate } from '@/shared/validation/validate';
import { ROLE_LEVEL } from '@/server/auth/rbac';

/**
 * Why this file exists: GET (list/search/filter/sort/paginate) and POST
 * for the Product collection. GET goes through `ProductSearchService`
 * (this sprint's lightweight, sort-aware list query — see
 * product-search.repository.impl.ts for why it's separate from
 * ProductService.searchProducts); POST goes through `ProductService`
 * (Sprint 2.2's full create-with-variants orchestration).
 *
 * `meta.pagination` carries `nextCursor`/`hasMore` for the client's next
 * request — cursor pagination throughout, per the API architecture's §19.
 */

const productService = new ProductService();
const productSearchService = new ProductSearchService();

export const GET = createCatalogRoute(async ({ req }) => {
  const query = parseSearchParams(req, productSearchQuerySchema);
  const page = await productSearchService.search(query);
  return {
    data: page.data,
    message: 'Products retrieved.',
    meta: { pagination: { nextCursor: page.nextCursor, hasMore: page.hasMore } },
  };
});

export const POST = createCatalogRoute(
  async ({ req }) => {
    const body = validate(createProductSchema, await req.json());
    const product = await productService.createProduct(body);
    return { data: toProductDto(product), message: 'Product created.', status: 201 };
  },
  { requiredRoleLevel: ROLE_LEVEL.manager },
);
