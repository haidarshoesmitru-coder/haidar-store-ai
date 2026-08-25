/**
 * Why this file exists: a small, deliberately short list of values shared
 * across feature modules. This is NOT a dumping ground — a constant used
 * by exactly one feature belongs in that feature's own files, not here.
 * Only things genuinely cross-cutting (pagination defaults referenced by
 * every list endpoint, session timing) belong in this file.
 *
 * Dependencies: none.
 * Future usage: pagination constants will be imported by every future
 * list endpoint (products, orders, audit log) per §19 of the API design.
 */

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 24,
  MAX_PAGE_SIZE: 200,
} as const;

export const SESSION = {
  CUSTOMER_MAX_AGE_SECONDS: 30 * 24 * 60 * 60, // 30 days
  STAFF_MAX_AGE_SECONDS: 8 * 60 * 60, // 8 hours — shorter idle timeout for admin sessions
} as const;
