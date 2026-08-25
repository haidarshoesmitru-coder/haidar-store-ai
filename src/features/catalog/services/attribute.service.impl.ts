import type { Attribute } from '@prisma/client';
import { PrismaAttributeRepository, type IAttributeRepository } from '@/features/catalog/repositories/attribute.repository.impl';
import type { CreateAttributeInput } from '@/features/catalog/validation/attribute.validation';
import { AttributeAlreadyExistsError } from '@/features/catalog/attribute-errors';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: business logic for Attribute management — the
 * one rule that matters is "no duplicate attribute codes" (the same
 * governance concern that keeps "Size"/"size"/"SIZE" from becoming three
 * different attributes, named explicitly in Sprint 2.1's own docs).
 *
 * Dependencies: attribute.repository.impl.ts, attribute-errors.ts, logger.ts.
 * Future usage: constructed by the new Attribute API route; consumed by
 * the admin panel's ProductForm for the dynamic-attribute picker.
 */
export class AttributeService {
  constructor(private readonly attributeRepository: IAttributeRepository = new PrismaAttributeRepository()) {}

  async listAttributes(): Promise<Attribute[]> {
    return this.attributeRepository.findAll();
  }

  async createAttribute(input: CreateAttributeInput): Promise<Attribute> {
    const codeTaken = await this.attributeRepository.existsByCode(input.code);
    if (codeTaken) {
      logger.warn('Attribute creation rejected: duplicate code', { code: input.code });
      throw new AttributeAlreadyExistsError(input.code);
    }

    const attribute = await this.attributeRepository.create({
      name: input.name,
      code: input.code,
      dataType: input.dataType,
    });

    logger.info('Attribute created', { attributeId: attribute.id, code: attribute.code });
    return attribute;
  }
}
