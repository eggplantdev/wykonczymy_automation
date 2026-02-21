import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'

export async function getCashRegister(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.cashRegisters, entityTag('cash-register', id))

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  try {
    const register = await payload.findByID({
      collection: 'cash-registers',
      id,
      depth: 1,
      overrideAccess: true,
    })
    console.log(`[PERF] query.getCashRegister(${id}) ${elapsed()}ms`)
    return register ?? null
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawCashRegisterDocT = Record<string, any>

export async function findAllCashRegistersRaw() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.cashRegisters)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'cash-registers',
    pagination: false,
    sort: 'name',
    depth: 0,
    overrideAccess: true,
  })
  console.log(`[PERF] query.findAllCashRegistersRaw ${elapsed()}ms (${result.docs.length} docs)`)

  return result.docs as RawCashRegisterDocT[]
}

/**
 * Maps raw cash register docs (depth: 0) to CashRegisterRowT using a workers name map.
 */
export function mapCashRegisterRows(
  docs: RawCashRegisterDocT[],
  workersMap: Map<number, string>,
): CashRegisterRowT[] {
  return docs.map((cr) => ({
    id: cr.id as number,
    name: cr.name as string,
    ownerName:
      typeof cr.owner === 'number' ? (workersMap.get(cr.owner) ?? '—') : getOwnerName(cr.owner),
    balance: (cr.balance ?? 0) as number,
    type: (cr.type as 'MAIN' | 'AUXILIARY') ?? 'AUXILIARY',
    active: (cr.active ?? true) as boolean,
  }))
}

function getOwnerName(field: unknown): string {
  if (typeof field === 'object' && field !== null && 'name' in field) {
    return (field as { name: string }).name
  }
  return '—'
}
