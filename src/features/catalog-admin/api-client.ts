'use client';

/**
 * Why this file exists: the ONE place in the admin panel that calls
 * `fetch` against `/api/v1/*`. Every hook in this feature goes through
 * this — never a raw `fetch` scattered per-component — so the envelope
 * parsing (Sprint 2.3's `{ success, message, data, meta }` /
 * `{ success, error, code, details }` shape) and error handling are
 * written once. This is the browser-side mirror of "repositories only
 * access the database": here, "the admin UI only talks to the API
 * through this client."
 *
 * Session auth is a same-origin cookie (NextAuth, Sprint 1) — the browser
 * attaches it automatically to same-origin fetch calls, so no token
 * handling is needed here.
 *
 * Dependencies: none (fetch is a browser global).
 * Future usage: every hook in features/catalog-admin/hooks/.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details: { field: string; issue: string }[] | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface CatalogSuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}

interface CatalogErrorBody {
  success: false;
  error: string;
  code: string;
  details: { field: string; issue: string }[] | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; meta: Record<string, unknown> | null }> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  const body = (await response.json()) as CatalogSuccessBody<T> | CatalogErrorBody;

  if (!body.success) {
    throw new ApiError(body.error, body.code, response.status, body.details);
  }

  return { data: body.data, meta: body.meta };
}

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) searchParams.set(key, String(value));
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const apiClient = {
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>) =>
    request<T>(`${path}${query ? toQueryString(query) : ''}`),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
