import { ProductSearchRepository, type ProductListRowDto } from '@/features/catalog/repositories/product-search.repository.impl';
import type { CursorPage } from '@/features/catalog/types';
import type { ProductSearchQuery } from '@/features/catalog/validation/route-query.schema';

/**
 * Why this file exists: the task's own constraint — "do not bypass
 * Services" — means the product-listing route cannot call
 * `ProductSearchRepository` directly, even though that repository has no
 * business rules of its own to enforce (it's a pure read query). This is
 * a deliberately thin pass-through service rather than a sign this
 * repository needed more logic; keeping the repository -> service -> API
 * layering consistent everywhere is worth one small file even when the
 * service has nothing to add but the call itself.
 *
 * Dependencies: product-search.repository.impl.ts (this sprint).
 * Future usage: GET /api/v1/products (list/search/filter/sort/paginate).
 */
export class ProductSearchService {
  constructor(private readonly repository: ProductSearchRepository = new ProductSearchRepository()) {}

  async search(query: ProductSearchQuery): Promise<CursorPage<ProductListRowDto>> {
    return this.repository.search(query);
  }
}
