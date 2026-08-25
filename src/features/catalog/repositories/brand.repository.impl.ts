import { db } from '@/shared/lib/db';
import type { Brand } from '@prisma/client';
import type { IBrandRepository } from '@/features/catalog/repositories/brand.repository';

/** See category.repository.impl.ts for the shared rationale (why not BaseRepository, responsibility boundary). */
/**
 * Extended beyond Sprint 2.1's IBrandRepository with the query methods
 * BrandService needs for its business rules — see the matching note in
 * category.repository.impl.ts for the full rationale.
 */
export interface IBrandRepositoryExtended extends IBrandRepository {
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  countProducts(brandId: string): Promise<number>;
}

export class PrismaBrandRepository implements IBrandRepositoryExtended {
  async findById(id: string): Promise<Brand | null> {
    return db.brand.findFirst({ where: { id, deletedAt: null } });
  }

  async findBySlug(slug: string): Promise<Brand | null> {
    return db.brand.findFirst({ where: { slug, deletedAt: null } });
  }

  async findAllActive(): Promise<Brand[]> {
    return db.brand.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async create(input: Omit<Brand, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>): Promise<Brand> {
    return db.brand.create({ data: input });
  }

  async update(id: string, input: Partial<Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Brand> {
    return db.brand.update({ where: { id }, data: input });
  }

  async softDelete(id: string): Promise<void> {
    await db.brand.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Extra — backs BrandService's duplicate-slug rule. */
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const count = await db.brand.count({
      where: { slug, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return count > 0;
  }

  /** Extra — backs BrandService's BrandInUse rule. */
  async countProducts(brandId: string): Promise<number> {
    return db.product.count({ where: { brandId, deletedAt: null } });
  }
}
