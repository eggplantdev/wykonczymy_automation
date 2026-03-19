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

type SearchParamsT = Record<string, string | string[] | undefined>

export const DEFAULT_LIMIT = 20
export const ALLOWED_LIMITS: number[] = [20, 50, 100]

export function parsePagination(searchParams: SearchParamsT): PaginationParamsT {
  const pageParam = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1
  const page = pageParam > 0 ? pageParam : 1

  const limitParam =
    typeof searchParams.limit === 'string' ? Number(searchParams.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

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
