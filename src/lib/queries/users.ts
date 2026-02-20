import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import {
  sumAllWorkerSaldos,
  sumEmployeeSaldo,
  sumWorkerPeriodBreakdown,
  type WorkerPeriodBreakdownT,
} from '@/lib/db/sum-transfers'
import type { UserRowT } from '@/lib/tables/users'
import type { RoleT } from '@/lib/auth/roles'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'

export async function findUsersWithSaldos({ page, limit }: PaginationParamsT) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers, CACHE_TAGS.users)

  const start = performance.now()
  const payload = await getPayload({ config })
  const [users, saldoRecord] = await Promise.all([
    payload.find({
      collection: 'users',
      sort: 'name',
      limit,
      page,
      overrideAccess: true,
      where: {
        and: [{ role: { not_in: ['ADMIN', 'OWNER', 'MANAGER'] } }, { active: { equals: true } }],
      },
    }),
    sumAllWorkerSaldos(payload).then((map) => Object.fromEntries(map)),
  ])
  console.log(`[PERF] query.findUsersWithSaldos ${(performance.now() - start).toFixed(1)}ms`)

  const rows: UserRowT[] = users.docs.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as RoleT,
    saldo: saldoRecord[String(u.id)] ?? 0,
  }))

  return {
    rows,
    paginationMeta: buildPaginationMeta(users, limit),
  }
}

export async function findAllUsersWithSaldos() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers, CACHE_TAGS.users)

  const start = performance.now()
  const payload = await getPayload({ config })
  const [users, saldoRecord] = await Promise.all([
    payload.find({
      collection: 'users',
      sort: 'name',
      pagination: false,
      overrideAccess: true,
      where: {
        and: [{ role: { not_in: ['ADMIN', 'OWNER', 'MANAGER'] } }, { active: { equals: true } }],
      },
    }),
    sumAllWorkerSaldos(payload).then((map) => Object.fromEntries(map)),
  ])
  console.log(`[PERF] query.findAllUsersWithSaldos ${(performance.now() - start).toFixed(1)}ms`)

  return users.docs.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as RoleT,
    saldo: saldoRecord[String(u.id)] ?? 0,
  }))
}

export async function getUser(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.users, entityTag('user', id))

  const payload = await getPayload({ config })
  try {
    const user = await payload.findByID({ collection: 'users', id, overrideAccess: true })
    return user ?? null
  } catch {
    return null
  }
}

export async function getUserSaldo(userId: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await sumEmployeeSaldo(payload, Number(userId))
  console.log(`[PERF] query.getUserSaldo(${userId}) ${(performance.now() - start).toFixed(1)}ms`)
  return result
}

export async function getWorkerPeriodBreakdown(
  workerId: string,
  from: string,
  to: string,
): Promise<WorkerPeriodBreakdownT> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const payload = await getPayload({ config })
  return sumWorkerPeriodBreakdown(payload, Number(workerId), { start: from, end: to })
}

export async function findAllUsers() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.users)

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'users',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs.map((u) => ({
    id: u.id as number,
    name: u.name as string,
  }))
}
