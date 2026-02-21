import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import type { InvestmentRowT } from '@/lib/tables/investments'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload doc type varies by query
function mapInvestmentRow(inv: any): InvestmentRowT {
  return {
    id: inv.id,
    name: inv.name,
    status: inv.status as 'active' | 'completed',
    totalCosts: inv.totalCosts ?? 0,
    totalIncome: inv.totalIncome ?? 0,
    laborCosts: inv.laborCosts ?? 0,
    balance: (inv.totalIncome ?? 0) - (inv.totalCosts ?? 0) - (inv.laborCosts ?? 0),
    address: inv.address ?? '',
    phone: inv.phone ?? '',
    email: inv.email ?? '',
    contactPerson: inv.contactPerson ?? '',
  }
}

export async function findInvestments({ page, limit }: PaginationParamsT) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.investments)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'investments',
    sort: 'name',
    limit,
    page,
    overrideAccess: true,
  })
  console.log(`[PERF] query.findInvestments ${elapsed()}ms`)

  return {
    rows: result.docs.map(mapInvestmentRow),
    paginationMeta: buildPaginationMeta(result, limit),
  }
}

export async function getInvestment(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.investments, entityTag('investment', id))

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  try {
    const investment = await payload.findByID({
      collection: 'investments',
      id,
      overrideAccess: true,
    })
    console.log(`[PERF] query.getInvestment(${id}) ${elapsed()}ms`)
    return investment ?? null
  } catch {
    return null
  }
}

export async function findAllInvestments() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.investments)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'investments',
    pagination: false,
    sort: 'name',
    overrideAccess: true,
  })
  console.log(`[PERF] query.findAllInvestments ${elapsed()}ms (${result.docs.length} docs)`)

  return result.docs.map(mapInvestmentRow)
}

export async function findActiveInvestments() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.investments)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'investments',
    where: { status: { equals: 'active' } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  console.log(`[PERF] query.findActiveInvestments ${elapsed()}ms (${result.docs.length} docs)`)

  return result.docs.map((inv) => ({
    id: inv.id as number,
    name: inv.name as string,
  }))
}
