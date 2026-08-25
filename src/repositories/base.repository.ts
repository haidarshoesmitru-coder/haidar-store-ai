/**
 * Why this file exists:
 * This is the Repository Pattern boundary called for in the sprint scope.
 * Every feature's repository (UserRepository today; ProductRepository,
 * OrderRepository, etc. in later sprints) extends this instead of calling
 * `db.product.findUnique(...)` ad hoc from a service. Two concrete
 * benefits, not just pattern-for-pattern's-sake:
 *   1. Services depend on a repository *interface*, so a unit test can
 *      inject an in-memory fake instead of hitting Postgres.
 *   2. If we ever need to change how a model is queried everywhere (e.g.
 *      add soft-delete filtering to every findMany), there's one class per
 *      model to change, not every call site.
 *
 * Responsibility: the small set of operations common to every Prisma
 * model. Model-specific queries (e.g. `findByEmail`) belong in the
 * concrete repository, not here — this base stays generic on purpose.
 *
 * Dependencies: none directly — generic over whatever Prisma delegate
 * shape the concrete repository passes in.
 * Future usage: ProductRepository, OrderRepository, CategoryRepository,
 * etc. all extend this in their respective feature modules.
 */

interface PrismaDelegate<TModel, TWhereUnique, TWhereMany, TCreate, TUpdate> {
  findUnique(args: { where: TWhereUnique }): Promise<TModel | null>;
  findMany(args?: { where?: TWhereMany; take?: number; skip?: number }): Promise<TModel[]>;
  create(args: { data: TCreate }): Promise<TModel>;
  update(args: { where: TWhereUnique; data: TUpdate }): Promise<TModel>;
  delete(args: { where: TWhereUnique }): Promise<TModel>;
}

export abstract class BaseRepository<
  TModel,
  TWhereUnique,
  TWhereMany = Record<string, unknown>,
  TCreate = Partial<TModel>,
  TUpdate = Partial<TModel>,
> {
  protected constructor(
    private readonly delegate: PrismaDelegate<TModel, TWhereUnique, TWhereMany, TCreate, TUpdate>,
  ) {}

  async findById(where: TWhereUnique): Promise<TModel | null> {
    return this.delegate.findUnique({ where });
  }

  async findMany(where?: TWhereMany, options?: { take?: number; skip?: number }): Promise<TModel[]> {
    return this.delegate.findMany({ ...(where !== undefined ? { where } : {}), ...options });
  }

  async create(data: TCreate): Promise<TModel> {
    return this.delegate.create({ data });
  }

  async update(where: TWhereUnique, data: TUpdate): Promise<TModel> {
    return this.delegate.update({ where, data });
  }

  async delete(where: TWhereUnique): Promise<TModel> {
    return this.delegate.delete({ where });
  }
}
