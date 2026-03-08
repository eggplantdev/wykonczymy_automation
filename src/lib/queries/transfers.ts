import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'

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
  // Impossible condition — forces Payload to return zero results
  const NO_RESULTS = { equals: -1 } as const
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
    const types = typeParam
      .split(',')
      .filter((t) => (TRANSFER_TYPES as readonly string[]).includes(t))
    if (types.length > 0) where.type = { in: types }
    else where.id = NO_RESULTS // No valid types → return no results
  }

  // Source register filter (supports comma-separated multi-select)
  const sourceRegisterParam = getStringParam(searchParams.sourceRegister)
  const sourceRegisterIds = parseNumericIds(sourceRegisterParam)
  if (sourceRegisterIds.length > 0) where.sourceRegister = { in: sourceRegisterIds }
  else if (sourceRegisterParam) where.id = NO_RESULTS

  // Investment filter (supports comma-separated multi-select)
  const investmentParam = getStringParam(searchParams.investment)
  const investmentIds = parseNumericIds(investmentParam)
  if (investmentIds.length > 0) where.investment = { in: investmentIds }
  else if (investmentParam) where.id = NO_RESULTS

  // Created by filter — skip when onlyOwnTransfers is active (security: don't override role scope)
  if (!userContext.onlyOwnTransfers) {
    const createdByParam = getStringParam(searchParams.createdBy)
    const createdByIds = parseNumericIds(createdByParam)
    if (createdByIds.length > 0) where.createdBy = { in: createdByIds }
    else if (createdByParam) where.id = NO_RESULTS
  }

  // Worker filter — skip for employees (they already have worker scoped above)
  if (userContext.isManager) {
    const workerParam = getStringParam(searchParams.worker)
    const workerIds = parseNumericIds(workerParam)
    if (workerIds.length > 0) where.worker = { in: workerIds }
    else if (workerParam) where.id = NO_RESULTS
  }

  // Payment method filter (validates against known methods)
  const paymentMethodParam = getStringParam(searchParams.paymentMethod)
  if (paymentMethodParam) {
    const methods = paymentMethodParam
      .split(',')
      .filter((m) => (PAYMENT_METHODS as readonly string[]).includes(m))
    if (methods.length > 0) where.paymentMethod = { in: methods }
    else where.id = NO_RESULTS
  }

  // Other category filter
  const otherCategoryParam = getStringParam(searchParams.otherCategory)
  const otherCategoryIds = parseNumericIds(otherCategoryParam)
  if (otherCategoryIds.length > 0) where.otherCategory = { in: otherCategoryIds }
  else if (otherCategoryParam) where.id = NO_RESULTS

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
