import type { ResolvedSearchParamsT } from '@/types/page'

export type PaginationMetaT = {
  currentPage: number
  totalPages: number
  totalDocs: number
  limit: number
}

export type PaginationParamsT = {
  page: number
  limit: number
}

export const DEFAULT_LIMIT = 100
export const ALLOWED_LIMITS: number[] = [20, 50, 100]

/**
 * `defaultLimit` is what the list shows before anyone touches the „Pokaż" select, so it has to be one
 * of `ALLOWED_LIMITS` — the select renders those, and a default outside them would show a blank one
 * and be unreachable again once changed.
 */
export function parsePagination(
  searchParams: ResolvedSearchParamsT,
  defaultLimit: number = DEFAULT_LIMIT,
): PaginationParamsT {
  const pageParam = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1
  const page = pageParam > 0 ? pageParam : 1

  const limitParam =
    typeof searchParams.limit === 'string' ? Number(searchParams.limit) : defaultLimit
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : defaultLimit

  return { page, limit }
}

export function buildPaginationMeta(
  result: { page?: number; totalPages: number; totalDocs: number },
  limit: number,
): PaginationMetaT {
  return {
    currentPage: result.page ?? 1,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
    limit,
  }
}
