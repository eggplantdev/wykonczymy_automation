import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'

type FindTransfersOptsT = PaginationParamsT & {
  readonly where?: Where
  readonly sort?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawTransferDocT = Record<string, any>

export async function findTransfersRaw({
  where = {},
  page,
  limit,
  sort = '-date',
}: FindTransfersOptsT) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'transactions',
    where,
    sort,
    limit,
    page,
    depth: 0,
    overrideAccess: true,
  })
  console.log(
    `[PERF] query.findTransfersRaw ${elapsed()}ms (${result.docs.length} docs, page=${page})`,
  )

  return {
    docs: result.docs as RawTransferDocT[],
    paginationMeta: buildPaginationMeta(result, limit),
  }
}

type SearchParamsT = Record<string, string | string[] | undefined>

type UserContextT = {
  readonly id: number
  readonly isManager: boolean
  readonly onlyOwnTransfers?: boolean
}

export function buildTransferFilters(
  searchParams: SearchParamsT,
  userContext: UserContextT,
): Where {
  const where: Where = {}

  // EMPLOYEE: always filter by own worker ID
  if (!userContext.isManager) {
    where.worker = { equals: userContext.id }
  }

  // Manager scoped to own transactions (dashboard only)
  if (userContext.onlyOwnTransfers) {
    where.createdBy = { equals: userContext.id }
  }

  // Type filter (supports comma-separated multi-select)
  const typeParam = getStringParam(searchParams.type)
  if (typeParam) {
    const types = typeParam.split(',').filter((t) => (TRANSFER_TYPES as readonly string[]).includes(t))
    if (types.length > 0) where.type = { in: types }
  }

  // Source register filter (supports comma-separated multi-select)
  const sourceRegisterIds = parseNumericIds(getStringParam(searchParams.sourceRegister))
  if (sourceRegisterIds.length > 0) where.sourceRegister = { in: sourceRegisterIds }

  // Investment filter (supports comma-separated multi-select)
  const investmentIds = parseNumericIds(getStringParam(searchParams.investment))
  if (investmentIds.length > 0) where.investment = { in: investmentIds }

  // Created by filter — skip when onlyOwnTransfers is active (security: don't override role scope)
  if (!userContext.onlyOwnTransfers) {
    const createdByIds = parseNumericIds(getStringParam(searchParams.createdBy))
    if (createdByIds.length > 0) where.createdBy = { in: createdByIds }
  }

  // Date range
  const fromParam = getStringParam(searchParams.from)
  const toParam = getStringParam(searchParams.to)
  if (fromParam || toParam) {
    where.date = {}
    if (fromParam) (where.date as Record<string, string>).greater_than_equal = fromParam
    if (toParam) (where.date as Record<string, string>).less_than_equal = toParam
  }

  return where
}

function getStringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseNumericIds(param: string | undefined): number[] {
  if (!param) return []
  return param.split(',').map(Number).filter(Boolean)
}
