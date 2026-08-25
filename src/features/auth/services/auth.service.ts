import bcrypt from 'bcryptjs';
import { UserRepository } from '@/features/auth/repositories/user.repository';
import type { AuthUser, Credentials } from '@/features/auth/types';
import { logger } from '@/shared/lib/logger';

/**
 * Why this file exists: this is the "Service Layer Foundation" item from
 * the sprint scope, made concrete. It's the pattern every future feature
 * service follows:
 *   - depends on a repository (injected via constructor, not imported
 *     globally — this is what makes it unit-testable with a fake
 *     repository and no real database)
 *   - contains the actual business rule (credential verification), not
 *     just a pass-through to the repository
 *   - knows nothing about HTTP, NextAuth, or Next.js — it could be called
 *     from a route handler, a script, or a test with zero changes.
 *
 * Responsibility: authentication business logic only. Session creation,
 * cookies, and JWT/session strategy are NextAuth's job (auth-config.ts) —
 * deliberately kept out of this file so the business rule ("are these
 * credentials valid, and is the account active") stays independent of
 * which session mechanism the app happens to use.
 *
 * Dependencies: UserRepository, bcryptjs, logger.
 * Future usage: called from auth-config.ts's credentials provider. A
 * future "change password" admin feature reuses this same service rather
 * than re-implementing hashing/comparison logic.
 */

export class AuthService {
  constructor(private readonly userRepository: UserRepository = new UserRepository()) {}

  /**
   * Returns the authenticated user, or null if credentials are invalid or
   * the account is suspended. Deliberately returns null rather than
   * throwing for "bad credentials" — NextAuth's credentials provider
   * expects that contract, and a service-level distinction between "wrong
   * password" and "no such user" would let an attacker enumerate valid
   * emails, which we do not want.
   */
  async verifyCredentials({ email, password }: Credentials): Promise<AuthUser | null> {
    const user = await this.userRepository.findByIdWithRole(
      // findByEmail doesn't include role; re-fetch with role once we know
      // the user exists. Two queries, but auth is not a hot path — clarity
      // wins over micro-optimizing a login request.
      (await this.userRepository.findByEmail(email))?.id ?? '',
    );

    if (!user) {
      logger.warn('Login attempt for unknown email', { email });
      return null;
    }

    if (user.status !== 'ACTIVE') {
      logger.warn('Login attempt for inactive account', { userId: user.id });
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      logger.warn('Login attempt with incorrect password', { userId: user.id });
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role.name,
      roleLevel: user.role.level,
    };
  }

  /** Used by future admin "create staff account" flows and by the seed data path. */
  async hashPassword(plainTextPassword: string): Promise<string> {
    const SALT_ROUNDS = 12;
    return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
  }
}
