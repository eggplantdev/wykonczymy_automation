import { unstable_cache } from 'next/cache'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Payload, Where } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/utils/pagination'
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

  const ids = result.rows.map((row) => Number(row.id))

  if (ids.length === 0) return { ...rest, id: { equals: -1 } }
  return { ...rest, id: { in: ids } }
}

/**
 * Fetch transactions by raw IDs, bypassing all filters (used by audit mode to splice
 * cancellation originals into the page result regardless of period or cancelled status).
 */
async function findTransfersByIds(ids: number[]): Promise<RawTransferDocT[]> {
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
