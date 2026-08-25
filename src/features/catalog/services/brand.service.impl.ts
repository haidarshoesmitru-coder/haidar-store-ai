import type { Brand } from '@prisma/client';
import type { IBrandService } from '@/features/catalog/services/brand.service';
import {
  PrismaBrandRepository,
  type IBrandRepositoryExtended,
} from '@/features/catalog/repositories/brand.repository.impl';
import type { CreateBrandInput, UpdateBrandInput } from '@/features/catalog/validation/brand.validation';
import { BrandNotFoundError, BrandAlreadyExistsError, BrandInUseError } from '@/features/catalog/errors';
import { logger } from '@/shared/lib/logger';
import { stripUndefined } from '@/shared/utils/strip-undefined';

/** See category.service.impl.ts for the shared design rationale (alias pattern, business-rule ownership). */
export class BrandService implements IBrandService {
  constructor(private readonly brandRepository: IBrandRepositoryExtended = new PrismaBrandRepository()) {}

  async getById(id: string): Promise<Brand | null> {
    return this.brandRepository.findById(id);
  }

  async listActive(): Promise<Brand[]> {
    return this.brandRepository.findAllActive();
  }

  async createBrand(input: CreateBrandInput): Promise<Brand> {
    const slugTaken = await this.brandRepository.existsBySlug(input.slug);
    if (slugTaken) {
      logger.warn('Brand creation rejected: duplicate slug', { slug: input.slug });
      throw new BrandAlreadyExistsError(input.slug);
    }

    const brand = await this.brandRepository.create({
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl ?? null,
      isActive: true,
    });

    logger.info('Brand created', { brandId: brand.id, slug: brand.slug });
    return brand;
  }

  async updateBrand(id: string, input: UpdateBrandInput): Promise<Brand> {
    const existing = await this.brandRepository.findById(id);
    if (!existing) throw new BrandNotFoundError(id);

    if (input.slug && input.slug !== existing.slug) {
      const slugTaken = await this.brandRepository.existsBySlug(input.slug, id);
      if (slugTaken) throw new BrandAlreadyExistsError(input.slug);
    }

    const brand = await this.brandRepository.update(id, stripUndefined(input));
    logger.info('Brand updated', { brandId: id });
    return brand;
  }

  async deleteBrand(id: string): Promise<void> {
    const existing = await this.brandRepository.findById(id);
    if (!existing) throw new BrandNotFoundError(id);

    const productCount = await this.brandRepository.countProducts(id);
    if (productCount > 0) {
      logger.warn('Brand deletion rejected: in use', { brandId: id, productCount });
      throw new BrandInUseError(id, productCount);
    }

    await this.brandRepository.softDelete(id);
    logger.info('Brand deleted (soft)', { brandId: id });
  }

  // --- IBrandService (Sprint 2.1 contract) — thin aliases ---
  create(input: CreateBrandInput): Promise<Brand> {
    return this.createBrand(input);
  }
  update(id: string, input: UpdateBrandInput): Promise<Brand> {
    return this.updateBrand(id, input);
  }
  archive(id: string): Promise<void> {
    return this.deleteBrand(id);
  }
}
