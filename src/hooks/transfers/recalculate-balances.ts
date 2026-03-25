import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { updateTag } from 'next/cache'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

/** Resolve relationship value to a numeric ID (handles populated objects). */
const resolveId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return undefined
}

/**
 * afterChange — revalidate caches after a transaction is created or updated.
 * No more SQL UPDATEs — balances are computed on read via cached functions.
 */
export const recalcAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc }) => {
  const elapsed = perfStart()
  console.log(`[PERF] recalcAfterChange START id=${doc.id} type=${doc.type}`)

  const registerId = resolveId(doc.sourceRegister)
  const prevRegisterId = resolveId(previousDoc?.sourceRegister)
  const targetRegisterId = resolveId(doc.targetRegister)
  const prevTargetRegisterId = resolveId(previousDoc?.targetRegister)
  const investmentId = resolveId(doc.investment)
  const prevInvestmentId = resolveId(previousDoc?.investment)

  // Revalidate entity-specific tags (for detail page caches)
  if (registerId) updateTag(entityTag('cash-register', registerId))
  if (prevRegisterId && prevRegisterId !== registerId)
    updateTag(entityTag('cash-register', prevRegisterId))
  if (targetRegisterId) updateTag(entityTag('cash-register', targetRegisterId))
  if (prevTargetRegisterId && prevTargetRegisterId !== targetRegisterId)
    updateTag(entityTag('cash-register', prevTargetRegisterId))
  if (investmentId) updateTag(entityTag('investment', investmentId))
  if (prevInvestmentId && prevInvestmentId !== investmentId)
    updateTag(entityTag('investment', prevInvestmentId))

  // Invalidate transfers collection tag — this covers fetchRegisterBalances,
  // fetchInvestmentFinancials, and fetchWorkerSaldos
  revalidateCollections(['transfers'])

  console.log(`[PERF] recalcAfterChange TOTAL ${elapsed()}ms`)

  return doc
}

/**
 * afterDelete — revalidate caches after a transaction is deleted.
 */
export const recalcAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  const elapsed = perfStart()
  console.log(`[PERF] recalcAfterDelete START id=${doc.id} type=${doc.type}`)

  const registerId = resolveId(doc.sourceRegister)
  const targetRegisterId = resolveId(doc.targetRegister)
  const investmentId = resolveId(doc.investment)

  // Revalidate entity-specific tags
  if (registerId) updateTag(entityTag('cash-register', registerId))
  if (targetRegisterId) updateTag(entityTag('cash-register', targetRegisterId))
  if (investmentId) updateTag(entityTag('investment', investmentId))

  revalidateCollections(['transfers'])

  console.log(`[PERF] recalcAfterDelete TOTAL ${elapsed()}ms`)

  return doc
}
