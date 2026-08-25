import { NotFoundError, ConflictError } from '@/shared/lib/errors';

/**
 * Why this file exists, and why it's not just added to errors.ts: this
 * sprint (2.4, the admin panel) needs an Attribute management API that
 * Sprint 2.3 never built — a real, previously-flagged gap (Sprint 2.1's
 * own docs noted "Attribute has no repository/service of its own... a
 * future admin screen would need it"). That's exactly this situation now.
 * But `errors.ts` was written in Sprint 2.2, which this sprint must not
 * modify — so these two errors get their own file instead of being
 * appended there. Same extends-Sprint-1-directly pattern as errors.ts,
 * just physically separate.
 *
 * Dependencies: shared/lib/errors.ts (Sprint 1, read-only).
 * Future usage: attribute.service.impl.ts (this sprint).
 */

export class AttributeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(`An attribute with code "${code}" already exists.`);
  }
}

export class AttributeNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Attribute', id);
  }
}
