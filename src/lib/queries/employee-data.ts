import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sumEmployeeSaldo, type DateRangeT } from '@/lib/db/sum-transfers'
import { mapTransferRow, extractInvoiceIds, buildTransferLookups } from '@/lib/tables/transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchMediaByIds } from '@/lib/queries/media'
import { buildPaginationMeta, DEFAULT_LIMIT, ALLOWED_LIMITS } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

export async function getCachedEmployeeSaldo(userId: number, dateRange?: DateRangeT) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const result = await sumEmployeeSaldo(payload, userId, dateRange)
  console.log(`[PERF] query.getCachedEmployeeSaldo(${userId}) ${elapsed()}ms`)
  return result
}

export async function getCachedMonthlyData(
  userId: number,
  month: number,
  year: number,
  page: number,
  limit: number,
) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const elapsed = perfStart()
  const payload = await getPayload({ config })

  const safeLimit = ALLOWED_LIMITS.includes(limit) ? limit : DEFAULT_LIMIT
  const safePage = page > 0 ? page : 1

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  const dateRange = {
    greater_than_equal: startDate.toISOString(),
    less_than_equal: endDate.toISOString(),
  }

  const [transactions, monthlySaldo, refData] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: userId }, date: dateRange },
      sort: '-date',
      limit: safeLimit,
      page: safePage,
      depth: 0,
      overrideAccess: true,
    }),
    sumEmployeeSaldo(payload, userId, {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    }),
    fetchReferenceData(),
  ])
  console.log(
    `[PERF] query.getCachedMonthlyData(user=${userId}, ${month}/${year}) ${elapsed()}ms (${transactions.docs.length} docs)`,
  )

  const invoiceIds = extractInvoiceIds(transactions.docs)
  const mediaMap = await fetchMediaByIds(invoiceIds)
  const lookups = buildTransferLookups(refData, mediaMap)

  return {
    rows: transactions.docs.map((doc) => mapTransferRow(doc, lookups)),
    paginationMeta: buildPaginationMeta(transactions, safeLimit),
    monthlySaldo,
  }
}
