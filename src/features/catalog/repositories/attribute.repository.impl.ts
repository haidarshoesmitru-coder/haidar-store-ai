import { db } from '@/shared/lib/db';
import type { Attribute } from '@prisma/client';

/**
 * Why this file exists: the concrete Attribute repository — new this
 * sprint, filling the gap Sprint 2.1 flagged and left open ("Attribute
 * has no repository/service of its own... Sprint 2.2 can add
 * IAttributeRepository if a dedicated admin screen is built"). No
 * interface/implementation split like the other repositories in this
 * module, since there's no prior-sprint interface file to satisfy — this
 * is genuinely new ground, so interface and implementation live together,
 * same reasoning as variant.service.ts in Sprint 2.2.
 *
 * Dependencies: db.ts (Sprint 1).
 * Future usage: constructed by attribute.service.impl.ts; consumed by the
 * admin panel's dynamic-attribute picker.
 */

export interface IAttributeRepository {
  findAll(): Promise<Attribute[]>;
  findById(id: string): Promise<Attribute | null>;
  existsByCode(code: string): Promise<boolean>;
  create(input: Omit<Attribute, 'id' | 'createdAt'>): Promise<Attribute>;
}

export class PrismaAttributeRepository implements IAttributeRepository {
  async findAll(): Promise<Attribute[]> {
    return db.attribute.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string): Promise<Attribute | null> {
    return db.attribute.findUnique({ where: { id } });
  }

  async existsByCode(code: string): Promise<boolean> {
    const count = await db.attribute.count({ where: { code } });
    return count > 0;
  }

  async create(input: Omit<Attribute, 'id' | 'createdAt'>): Promise<Attribute> {
    return db.attribute.create({ data: input });
  }
}
