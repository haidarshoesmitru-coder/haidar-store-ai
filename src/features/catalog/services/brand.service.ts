import type { Brand } from '@prisma/client';
import type { CreateBrandInput, UpdateBrandInput } from '@/features/catalog/validation/brand.validation';

/** See category.service.ts for the service-contract rationale shared across this module. */
export interface IBrandService {
  getById(id: string): Promise<Brand | null>;
  listActive(): Promise<Brand[]>;
  create(input: CreateBrandInput): Promise<Brand>;
  update(id: string, input: UpdateBrandInput): Promise<Brand>;
  /** Rejects (ConflictError) if the brand still has active products. */
  archive(id: string): Promise<void>;
}
