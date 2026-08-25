import type { IProductService } from '@/features/catalog/services/product.service';
import {
  PrismaProductRepository,
  type IProductRepositoryExtended,
} from '@/features/catalog/repositories/product.repository.impl';
import {
  PrismaCategoryRepository,
  PrismaSubCategoryRepository,
  type ICategoryRepositoryExtended,
  type ISubCategoryRepositoryExtended,
} from '@/features/catalog/repositories/category.repository.impl';
import { PrismaBrandRepository, type IBrandRepositoryExtended } from '@/features/catalog/repositories/brand.repository.impl';
import { VariantService } from '@/features/catalog/services/variant.service';
import type { ProductWithRelations, CursorPage } from '@/features/catalog/types';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductImageInput,
  ProductListQuery,
} from '@/features/catalog/validation/product.validation';
import type { ProductSearchDto } from '@/features/catalog/dto/product.dto';
import {
  ProductNotFoundError,
  ProductSlugAlreadyExistsError,
  CategoryNotFoundError,
  SubCategoryNotFoundError,
  BrandNotFoundError,
} from '@/features/catalog/errors';
import { logger } from '@/shared/lib/logger';
import { stripUndefined } from '@/shared/utils/strip-undefined';
import type { ProductImage } from '@prisma/client';

/**
 * Why this file exists: the orchestration layer described in Sprint 2.1's
 * `product.service.ts` doc comment, now actually implemented. `createProduct`
 * is the method that earns that description — it validates every foreign
 * key reference, creates the Product row, then delegates each variant's
 * creation (including its inventory initialization) to `VariantService`
 * rather than duplicating that logic here. One service orchestrates;
 * the other owns its own aggregate's rules — neither reaches into the
 * other's repository.
 *
 * Dependencies: product.repository.impl.ts, category.repository.impl.ts,
 * brand.repository.impl.ts (all for existence checks — repositories
 * directly, not their services, to keep this file's dependency graph
 * shallow for what are simple findById checks), variant.service.ts,
 * catalog/errors.ts, logger.ts.
 * Future usage: constructed by Sprint 2.3's Product API routes; consumed
 * later by the AI Content Studio for description updates.
 */
export class ProductService implements IProductService {
  constructor(
    private readonly productRepository: IProductRepositoryExtended = new PrismaProductRepository(),
    private readonly categoryRepository: ICategoryRepositoryExtended = new PrismaCategoryRepository(),
    private readonly subCategoryRepository: ISubCategoryRepositoryExtended = new PrismaSubCategoryRepository(),
    private readonly brandRepository: IBrandRepositoryExtended = new PrismaBrandRepository(),
    private readonly variantService: VariantService = new VariantService(),
  ) {}

  async getById(id: string): Promise<ProductWithRelations | null> {
    return this.productRepository.findById(id);
  }

  async getBySlug(slug: string): Promise<ProductWithRelations | null> {
    return this.productRepository.findBySlug(slug);
  }

  async list(query: ProductListQuery): Promise<CursorPage<ProductWithRelations>> {
    return this.productRepository.paginate(query);
  }

  async searchProducts(params: ProductSearchDto): Promise<CursorPage<ProductWithRelations>> {
    return this.productRepository.search(params);
  }

  async createProduct(input: CreateProductInput): Promise<ProductWithRelations> {
    await this.assertReferencesExist(input.categoryId, input.subCategoryId, input.brandId);

    const slugTaken = await this.productRepository.existsBySlug(input.slug);
    if (slugTaken) {
      logger.warn('Product creation rejected: duplicate slug', { slug: input.slug });
      throw new ProductSlugAlreadyExistsError(input.slug);
    }

    const product = await this.productRepository.create({
      categoryId: input.categoryId,
      subCategoryId: input.subCategoryId ?? null,
      brandId: input.brandId ?? null,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      status: input.status,
      season: input.season ?? null,
      isFeatured: input.isFeatured,
      isBestSeller: input.isBestSeller,
      isNewArrival: input.isNewArrival,
    });

    // Ensure exactly one variant is `isDefault` — if the caller didn't
    // mark one, the first variant in the array becomes the default. A
    // product with variants but no default would have nothing for a
    // product card to show a price from.
    const hasExplicitDefault = input.variants.some((variant) => variant.isDefault);
    for (const [index, variantInput] of input.variants.entries()) {
      await this.variantService.createVariant(product.id, {
        ...variantInput,
        isDefault: hasExplicitDefault ? variantInput.isDefault : index === 0,
      });
    }

    logger.info('Product created', { productId: product.id, slug: product.slug, variantCount: input.variants.length });

    const created = await this.productRepository.findById(product.id);
    if (!created) throw new ProductNotFoundError(product.id); // unreachable in practice, satisfies the return type
    return created;
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductWithRelations> {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new ProductNotFoundError(id);

    await this.assertReferencesExist(
      input.categoryId ?? existing.categoryId,
      input.subCategoryId !== undefined ? input.subCategoryId : (existing.subCategoryId ?? undefined),
      input.brandId !== undefined ? input.brandId : (existing.brandId ?? undefined),
    );

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await this.productRepository.existsBySlug(input.slug, id);
      if (slugTaken) throw new ProductSlugAlreadyExistsError(input.slug);
    }

    await this.productRepository.update(id, stripUndefined(input));
    logger.info('Product updated', { productId: id });

    const updated = await this.productRepository.findById(id);
    if (!updated) throw new ProductNotFoundError(id);
    return updated;
  }

  async archiveProduct(id: string): Promise<void> {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new ProductNotFoundError(id);

    await this.productRepository.softDelete(id);
    logger.info('Product archived', { productId: id });
  }

  async restoreProduct(id: string): Promise<ProductWithRelations> {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new ProductNotFoundError(id);

    await this.productRepository.restore(id);
    logger.info('Product restored', { productId: id });

    const restored = await this.productRepository.findById(id);
    if (!restored) throw new ProductNotFoundError(id);
    return restored;
  }

  async featureProduct(id: string, isFeatured: boolean): Promise<void> {
    await this.requireExisting(id);
    await this.productRepository.update(id, { isFeatured });
    logger.info('Product featured flag updated', { productId: id, isFeatured });
  }

  async markBestSeller(id: string, isBestSeller: boolean): Promise<void> {
    await this.requireExisting(id);
    await this.productRepository.update(id, { isBestSeller });
    logger.info('Product best-seller flag updated', { productId: id, isBestSeller });
  }

  async markNewArrival(id: string, isNewArrival: boolean): Promise<void> {
    await this.requireExisting(id);
    await this.productRepository.update(id, { isNewArrival });
    logger.info('Product new-arrival flag updated', { productId: id, isNewArrival });
  }

  async addImage(productId: string, input: ProductImageInput): Promise<ProductImage> {
    await this.requireExisting(productId);
    const image = await this.productRepository.addImage({
      productId,
      variantId: input.variantId ?? null,
      url: input.url,
      altText: input.altText ?? null,
      sortOrder: input.sortOrder,
      isPrimary: input.isPrimary,
    });
    logger.info('Product image added', { productId, imageId: image.id });
    return image;
  }

  async removeImage(productId: string, imageId: string): Promise<void> {
    await this.requireExisting(productId);
    await this.productRepository.removeImage(imageId);
    logger.info('Product image removed', { productId, imageId });
  }

  private async requireExisting(id: string): Promise<void> {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new ProductNotFoundError(id);
  }

  private async assertReferencesExist(
    categoryId: string,
    subCategoryId?: string,
    brandId?: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw new CategoryNotFoundError(categoryId);

    if (subCategoryId) {
      const subCategory = await this.subCategoryRepository.findById(subCategoryId);
      if (!subCategory) throw new SubCategoryNotFoundError(subCategoryId);
    }

    if (brandId) {
      const brand = await this.brandRepository.findById(brandId);
      if (!brand) throw new BrandNotFoundError(brandId);
    }
  }

  // --- IProductService (Sprint 2.1 contract) — thin aliases ---
  create(input: CreateProductInput): Promise<ProductWithRelations> {
    return this.createProduct(input);
  }
  update(id: string, input: UpdateProductInput): Promise<ProductWithRelations> {
    return this.updateProduct(id, input);
  }
  archive(id: string): Promise<void> {
    return this.archiveProduct(id);
  }
}
