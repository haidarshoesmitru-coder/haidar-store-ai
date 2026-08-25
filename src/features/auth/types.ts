/**
 * Why this file exists: decouples the rest of the app from Prisma's
 * generated `User` type. A service returning the raw Prisma `User` would
 * leak `passwordHash` into anything that touches the object; `AuthUser` is
 * the safe, deliberate subset that's actually meant to leave the service
 * layer.
 *
 * Dependencies: none.
 * Future usage: session.ts, rbac.ts, and any future "current user" display
 * in the UI all use `AuthUser`, never the raw Prisma model.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleName: string;
  roleLevel: number;
}

export interface Credentials {
  email: string;
  password: string;
}
