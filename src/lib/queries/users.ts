import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  sumAllWorkerSaldos,
  sumEmployeeSaldo,
  sumWorkerPeriodBreakdown,
} from '@/lib/db/sum-transfers'
import type { UserDetailT } from '@/types/users'
import type { UserRowT } from '@/lib/tables/users'
import type { RoleT } from '@/lib/auth/roles'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload doc type varies by query
function mapUserRow(u: any, saldoRecord: Record<string, number>): UserRowT {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as RoleT,
    saldo: saldoRecord[String(u.id)] ?? 0,
    active: (u.active ?? true) as boolean,
  }
}

export async function findAllUsersWithSaldos() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers, CACHE_TAGS.users)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const [users, saldoRecord] = await Promise.all([
    payload.find({
      collection: 'users',
      sort: 'name',
      pagination: false,
      overrideAccess: true,
      where: { role: { equals: 'EMPLOYEE' } },
    }),
    sumAllWorkerSaldos(payload).then((map) => Object.fromEntries(map)),
  ])
  console.log(`[PERF] query.findAllUsersWithSaldos ${elapsed()}ms`)

  return users.docs.map((u) => mapUserRow(u, saldoRecord))
}

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
