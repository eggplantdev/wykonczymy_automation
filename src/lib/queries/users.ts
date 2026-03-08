import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  sumFilteredByType,
  deriveWorkerBreakdown,
  type WorkerPeriodBreakdownT,
} from '@/lib/db/sum-transfers'
import { WORKER_SALDO_TYPES } from '@/lib/constants/transfers'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

export async function fetchWorkerPeriodBreakdown(
  id: string,
  dateRange: { from: string; to: string },
): Promise<WorkerPeriodBreakdownT> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers, entityTag('user', id))

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const byType = await sumFilteredByType(payload, {
    worker: { equals: Number(id) },
    type: { in: WORKER_SALDO_TYPES },
    date: { greater_than_equal: dateRange.from, less_than_equal: dateRange.to },
  })
  console.log(`[PERF] query.fetchWorkerPeriodBreakdown(${id}) ${elapsed()}ms`)
  return deriveWorkerBreakdown(byType)
}
