import type { Prisma, User } from '@prisma/client';
import { db } from '@/shared/lib/db';
import { BaseRepository } from '@/repositories/base.repository';

/**
 * Why this file exists: the concrete example of the repository pattern —
 * every future feature (ProductRepository, OrderRepository, ...) follows
 * this exact shape: extend BaseRepository, pass the Prisma delegate in the
 * constructor, add only the queries the base class doesn't cover.
 *
 * Responsibility: all direct Prisma access for the `users` table. The auth
 * service never imports `db` itself — it goes through this class, which
 * is what lets the service be unit-tested against a fake repository.
 *
 * Dependencies: db.ts (Prisma client), base.repository.ts.
 * Future usage: AuthService (below) is the only consumer today. A future
 * admin "manage staff" module will reuse this same repository rather than
 * writing its own user queries.
 */

export class UserRepository extends BaseRepository<
  User,
  Prisma.UserWhereUniqueInput,
  Prisma.UserWhereInput,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  constructor() {
    super(db.user);
  }

  /** Not covered by the generic base — email lookup is specific to auth. */
  async findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  }

  /** Included so the RBAC helper can resolve a user's role level in one query. */
  async findByIdWithRole(id: string) {
    return db.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }
}
