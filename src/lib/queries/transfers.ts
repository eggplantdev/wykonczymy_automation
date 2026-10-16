import { cached } from '@/lib/cache/cached'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Payload, Where } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/utils/pagination'
import { getDb } from '@/lib/db/get-db'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'
import { FIELDS_ONLY_THE_ORIGINAL_CARRIES } from '@/lib/queries/transfer-filters'
import { DEFAULT_TRANSFER_SORT } from '@/lib/transfers/sortable-columns'

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
  sort = DEFAULT_TRANSFER_SORT,
}: FindTransfersOptsT) {
  return cached(
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

async function resolveAmountSearch(payload: Payload, where: Where): Promise<Where> {
  const amountCond = where.amount as Record<string, unknown> | undefined
  if (!amountCond || typeof amountCond !== 'object' || !('like' in amountCond)) return where

  const search = String(amountCond.like)
  const { amount: _, ...rest } = where

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

async function findTransfersByIds(ids: number[]): Promise<RawTransferDocT[]> {
  if (ids.length === 0) return []
  const sortedIds = [...ids].sort((a, b) => a - b)
  return cached(
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
      ...Object.fromEntries(
        FIELDS_ONLY_THE_ORIGINAL_CARRIES.map((field) => [field, orig[field] ?? null]),
      ),
      originalType: orig.type ?? null,
    }
  })
}
