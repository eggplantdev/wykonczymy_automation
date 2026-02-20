import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Where } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transfers'

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

  const start = performance.now()
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
    `[PERF] query.findTransfersRaw ${(performance.now() - start).toFixed(1)}ms (${result.docs.length} docs, page=${page})`,
  )

  return {
    docs: result.docs as RawTransferDocT[],
    paginationMeta: buildPaginationMeta(result, limit),
  }
}

export async function findAllTransfersRaw({
  where = {},
  sort = '-date',
}: {
  readonly where?: Where
  readonly sort?: string
}) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'transactions',
    where,
    sort,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  console.log(
    `[PERF] query.findAllTransfersRaw ${(performance.now() - start).toFixed(1)}ms (${result.docs.length} docs)`,
  )

  return result.docs as RawTransferDocT[]
}

export async function countRecentTransfers(sinceDate: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const start = performance.now()
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const result = await db.execute(
    sql`SELECT COUNT(*) AS count FROM transactions WHERE date >= ${sinceDate}`,
  )
  const count = Number(result.rows[0].count)
  console.log(
    `[PERF] query.countRecentTransfers ${(performance.now() - start).toFixed(1)}ms (${count} total)`,
  )

  return count
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

  // Type filter
  const typeParam = typeof searchParams.type === 'string' ? searchParams.type : undefined
  if (typeParam) {
    where.type = { equals: typeParam }
  }

  // Cash register filter
  const cashRegisterParam =
    typeof searchParams.cashRegister === 'string' ? searchParams.cashRegister : undefined
  if (cashRegisterParam) {
    where.cashRegister = { equals: Number(cashRegisterParam) }
  }

  // Investment filter
  const investmentParam =
    typeof searchParams.investment === 'string' ? searchParams.investment : undefined
  if (investmentParam) {
    where.investment = { equals: Number(investmentParam) }
  }

  // Created by filter
  const createdByParam =
    typeof searchParams.createdBy === 'string' ? searchParams.createdBy : undefined
  if (createdByParam) {
    where.createdBy = { equals: Number(createdByParam) }
  }

  // Date range
  const fromParam = typeof searchParams.from === 'string' ? searchParams.from : undefined
  const toParam = typeof searchParams.to === 'string' ? searchParams.to : undefined
  if (fromParam || toParam) {
    where.date = {}
    if (fromParam) (where.date as Record<string, string>).greater_than_equal = fromParam
    if (toParam) (where.date as Record<string, string>).less_than_equal = toParam
  }

  return where
}
