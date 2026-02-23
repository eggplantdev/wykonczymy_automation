import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sumWorkerPeriodBreakdown, type WorkerPeriodBreakdownT } from '@/lib/db/sum-transfers'
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
  const breakdown = await sumWorkerPeriodBreakdown(payload, Number(id), {
    start: dateRange.from,
    end: dateRange.to,
  })
  console.log(`[PERF] query.fetchWorkerPeriodBreakdown(${id}) ${elapsed()}ms`)
  return breakdown
}
