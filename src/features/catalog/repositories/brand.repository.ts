import type { Brand } from '@prisma/client';

/** See category.repository.ts for the rationale shared by every repository interface in this module. */
export interface IBrandRepository {
  findById(id: string): Promise<Brand | null>;
  findBySlug(slug: string): Promise<Brand | null>;
  findAllActive(): Promise<Brand[]>;
  create(input: Omit<Brand, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt'>): Promise<Brand>;
  update(id: string, input: Partial<Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Brand>;
  softDelete(id: string): Promise<void>;
}
