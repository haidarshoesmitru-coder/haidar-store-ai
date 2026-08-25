/**
 * Why this file exists: the one generic pagination/search shape every
 * other DTO file in this module reuses, rather than each entity
 * reinventing its own cursor/hasMore fields. Matches the API
 * architecture's §19 (cursor-based, never offset).
 *
 * Dependencies: none.
 * Future usage: every list/search method's return type across
 * category/brand/product/variant DTOs.
 */

export interface PaginationParamsDto {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Base search params — entity-specific DTOs extend this with their own filters. */
export interface SearchParamsDto extends PaginationParamsDto {
  query?: string;
}
