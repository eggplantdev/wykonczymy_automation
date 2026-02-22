import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sumEmployeeSaldo, sumWorkerPeriodBreakdown } from '@/lib/db/sum-transfers'
import type { UserDetailT } from '@/types/users'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

export async function getUserDetail(
  id: string,
  dateRange?: { from: string; to: string },
): Promise<UserDetailT | null> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.users, CACHE_TAGS.transfers, entityTag('user', id))

  const payload = await getPayload({ config })

  let user
  try {
    user = await payload.findByID({ collection: 'users', id, overrideAccess: true })
  } catch {
    return null
  }
  if (!user) return null

  const elapsed = perfStart()
  const [saldo, periodBreakdown] = await Promise.all([
    sumEmployeeSaldo(payload, Number(id)),
    dateRange
      ? sumWorkerPeriodBreakdown(payload, Number(id), { start: dateRange.from, end: dateRange.to })
      : Promise.resolve(undefined),
  ])
  console.log(`[PERF] query.getUserDetail(${id}) ${elapsed()}ms`)

  return {
    name: user.name as string,
    email: user.email as string,
    role: user.role as string,
    saldo,
    periodBreakdown,
  }
}
