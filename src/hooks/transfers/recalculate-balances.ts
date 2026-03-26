import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
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
  if (registerId) revalidateTag(entityTag('cash-register', registerId), 'default')
  if (prevRegisterId && prevRegisterId !== registerId)
    revalidateTag(entityTag('cash-register', prevRegisterId), 'default')
  if (targetRegisterId) revalidateTag(entityTag('cash-register', targetRegisterId), 'default')
  if (prevTargetRegisterId && prevTargetRegisterId !== targetRegisterId)
    revalidateTag(entityTag('cash-register', prevTargetRegisterId), 'default')
  if (investmentId) revalidateTag(entityTag('investment', investmentId), 'default')
  if (prevInvestmentId && prevInvestmentId !== investmentId)
    revalidateTag(entityTag('investment', prevInvestmentId), 'default')

  // Invalidate transfers collection tag — this covers fetchRegisterBalances,
  // fetchInvestmentFinancials, and fetchWorkerSaldos
  // Payload hooks run in Route Handler context — must use revalidateTag, not updateTag
  revalidateTag(CACHE_TAGS.transfers, 'default')

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
  if (registerId) revalidateTag(entityTag('cash-register', registerId), 'default')
  if (targetRegisterId) revalidateTag(entityTag('cash-register', targetRegisterId), 'default')
  if (investmentId) revalidateTag(entityTag('investment', investmentId), 'default')

  // Payload hooks run in Route Handler context — must use revalidateTag, not updateTag
  revalidateTag(CACHE_TAGS.transfers, 'default')

  console.log(`[PERF] recalcAfterDelete TOTAL ${elapsed()}ms`)

  return doc
}
