import { unstable_cache } from 'next/cache'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Payload, Where } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { getDb } from '@/lib/db/sum-transfers'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'

type FindTransfersOptsT = PaginationParamsT & {
  where?: Where
  sort?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawTransferDocT = Record<string, any>

export async function findTransfersRaw({
  where = {},
  page,
  limit,
  sort = '-id',
}: FindTransfersOptsT) {
  // 'use cache'
  // cacheLife('max')
  // cacheTag(CACHE_TAGS.transfers)

  return unstable_cache(
    async () => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })

      // Payload's `like` doesn't work on number columns — resolve via raw SQL
      const resolvedWhere = await resolveAmountSearch(payload, where)

      const result = await payload.find({
        collection: 'transactions',
        where: resolvedWhere,
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
    },
    ['transfers-raw', JSON.stringify(where), String(page), String(limit), sort],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

/**
 * Resolves `amount: { like: '...' }` to `id: { in: [...] }` via raw SQL.
 *
 * Two-query pattern:
 * 1. Raw SQL finds transaction IDs where amount starts with the search term
 *    (e.g. "15" matches 15, 150, 1500 — prefix match, not substring)
 * 2. Those IDs replace the amount condition in the Payload Where object
 *
 * Why not use Payload's `like` directly?
 * Payload's `like` operator doesn't work on numeric columns —
 * it silently returns all rows. So we bypass Payload for this filter
 * and use raw SQL with `amount::text LIKE '15%'`.
 *
 * Performance: uses the trigram GIN index from migration 20260412.
 */
async function resolveAmountSearch(payload: Payload, where: Where): Promise<Where> {
  const amountCond = where.amount as Record<string, unknown> | undefined
  if (!amountCond || typeof amountCond !== 'object' || !('like' in amountCond)) return where

  const search = String(amountCond.like)
  const { amount: _, ...rest } = where

  // If another filter already forced NO_RESULTS, keep it
  const idCond = rest.id as Record<string, unknown> | undefined
  if (idCond && 'equals' in idCond && idCond.equals === -1) return rest

  const db = await getDb(payload)
  const result = await db.execute(sql`
    SELECT DISTINCT id FROM transactions
    WHERE amount::text LIKE ${search + '%'}
  `)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids = result.rows.map((r: any) => Number(r.id))

  if (ids.length === 0) return { ...rest, id: { equals: -1 } }
  return { ...rest, id: { in: ids } }
}

type SearchParamsT = Record<string, string | string[] | undefined>

type UserContextT = {
  id: number
  onlyOwnTransfers?: boolean
}

export function buildTransferFilters(
  searchParams: SearchParamsT,
  userContext: UserContextT,
): Where {
  // Impossible condition — forces Payload to return zero results
  const NO_RESULTS = { equals: -1 } as const
  const where: Where = {}

  // Manager scoped to own transactions (dashboard only)
  if (userContext.onlyOwnTransfers) {
    where.createdBy = { equals: userContext.id }
  }

  // Audit mode — show only CANCELLATION rows for the period; originals are merged in by the caller
  const cancelledTransactionAudit = getStringParam(searchParams.cancelledTransactionAudit) === '1'

  // Hide cancelled transfers by default (cancelled originals + CANCELLATION type)
  const showCancelled =
    getStringParam(searchParams.showCancelled) === '1' || cancelledTransactionAudit

  if (cancelledTransactionAudit) {
    where.type = { in: ['CANCELLATION'] }
  } else {
    // Type filter (supports comma-separated multi-select)
    const typeParam = getStringParam(searchParams.type)
    if (typeParam) {
      let types = typeParam
        .split(',')
        .filter((t) => (TRANSFER_TYPES as readonly string[]).includes(t))
      if (!showCancelled) types = types.filter((t) => t !== 'CANCELLATION')
      if (types.length > 0) where.type = { in: types }
      else where.id = NO_RESULTS // No valid types → return no results
    } else if (!showCancelled) {
      where.type = { not_in: ['CANCELLATION'] }
    }
  }

  if (!showCancelled) {
    where.cancelled = { not_equals: true }
  }

  // Cash register filter — matches source OR target register
  const sourceRegisterParam = getStringParam(searchParams.sourceRegister)
  const sourceRegisterIds = parseNumericIds(sourceRegisterParam)
  if (sourceRegisterIds.length > 0) {
    where.or = [
      { sourceRegister: { in: sourceRegisterIds } },
      { targetRegister: { in: sourceRegisterIds } },
    ]
  } else if (sourceRegisterParam) where.id = NO_RESULTS

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

  // Payment method filter (validates against known methods)
  const paymentMethodParam = getStringParam(searchParams.paymentMethod)
  if (paymentMethodParam) {
    const methods = paymentMethodParam
      .split(',')
      .filter((m) => (PAYMENT_METHODS as readonly string[]).includes(m))
    if (methods.length > 0) where.paymentMethod = { in: methods }
    else where.id = NO_RESULTS
  }

  // Expense category filter (investment expense type)
  const expenseCategoryParam = getStringParam(searchParams.expenseCategory)
  const expenseCategoryIds = parseNumericIds(expenseCategoryParam)
  if (expenseCategoryIds.length > 0) where.expenseCategory = { in: expenseCategoryIds }
  else if (expenseCategoryParam) where.id = NO_RESULTS

  // Other category filter
  const otherCategoryParam = getStringParam(searchParams.otherCategory)
  const otherCategoryIds = parseNumericIds(otherCategoryParam)
  if (otherCategoryIds.length > 0) where.otherCategory = { in: otherCategoryIds }
  else if (otherCategoryParam) where.id = NO_RESULTS

  // Amount search (substring match via LIKE on the numeric field)
  const amountParam = getStringParam(searchParams.amount)
  if (amountParam && /^\d+\.?\d*$/.test(amountParam)) {
    where.amount = { like: amountParam }
  }

  // ID search — exact match. Defers to NO_RESULTS if another filter already short-circuited.
  const idParam = getStringParam(searchParams.id)
  if (idParam && /^\d+$/.test(idParam) && !where.id) {
    where.id = { equals: Number(idParam) }
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

/**
 * Fetch transactions by raw IDs, bypassing all filters (used by audit mode to splice
 * cancellation originals into the page result regardless of period or cancelled status).
 */
export async function findTransfersByIds(ids: number[]): Promise<RawTransferDocT[]> {
  if (ids.length === 0) return []
  // Sort so the cache key is stable regardless of input order.
  const sortedIds = [...ids].sort((a, b) => a - b)
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'transactions',
        where: { id: { in: sortedIds } },
        limit: sortedIds.length,
        depth: 0,
        overrideAccess: true,
      })
      return result.docs as RawTransferDocT[]
    },
    ['transfers-by-ids', sortedIds.join(',')],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

/**
 * Fetch the originals referenced by CANCELLATION rows in `docs`, indexed by id.
 * Returns an empty map when there are no cancellation rows. Shared by the two
 * cancellation display paths (audit-mode splice and inline enrichment).
 */
export async function buildCancellationOriginalsMap(
  docs: RawTransferDocT[],
): Promise<Map<number, RawTransferDocT>> {
  const ids = docs
    .filter((d) => d.type === 'CANCELLATION')
    .map((d) => d.cancelledTransaction)
    .filter((v): v is number => typeof v === 'number')
  if (ids.length === 0) return new Map()
  const originals = await findTransfersByIds(ids)
  return new Map(originals.map((o) => [o.id as number, o]))
}

/**
 * A CANCELLATION audit row stores none of the original's relational fields
 * (see cancelTransferAction — only amount/description/paymentMethod are copied),
 * so it renders as all em-dashes. For display, borrow the original's investment /
 * registers / category / worker and stamp `originalType` for the Typ column.
 *
 * Display-only on purpose: the financial SQL in lib/db queries the DB directly and
 * never sees these merged docs, so this cannot affect register balances — unlike
 * persisting a sourceRegister onto the row, which the balance query would subtract.
 */
export async function enrichCancellationOriginals(
  docs: RawTransferDocT[],
): Promise<RawTransferDocT[]> {
  const originalsById = await buildCancellationOriginalsMap(docs)
  if (originalsById.size === 0) return docs

  return docs.map((doc) => {
    if (doc.type !== 'CANCELLATION') return doc
    const orig = originalsById.get(doc.cancelledTransaction as number)
    if (!orig) return doc
    return {
      ...doc,
      investment: orig.investment ?? null,
      sourceRegister: orig.sourceRegister ?? null,
      targetRegister: orig.targetRegister ?? null,
      expenseCategory: orig.expenseCategory ?? null,
      otherCategory: orig.otherCategory ?? null,
      worker: orig.worker ?? null,
      originalType: orig.type ?? null,
    }
  })
}

/** Strip cancelled-related conditions from a Where object (for stats queries that handle it in SQL). */
export function stripCancelledFilters(where: Where): Where {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cancelled, type, ...rest } = where
  const result: Where = { ...rest }
  // Keep type filter only if it's a user-selected inclusion filter, not the default not_in exclusion
  if (type && typeof type === 'object' && 'in' in type) {
    result.type = type
  }
  return result
}

function getStringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseNumericIds(param: string | undefined): number[] {
  if (!param) return []
  return param.split(',').map(Number).filter(Boolean)
}
