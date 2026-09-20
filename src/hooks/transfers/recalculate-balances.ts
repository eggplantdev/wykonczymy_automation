import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, entityTag, EXPIRE_NOW } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { resolveId } from '@/lib/utils/resolve-id'

/** Balances are computed on read via cached functions, so there is no write here. */
export const recalcAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  context,
}) => {
  // `revalidateTag` needs a Next request context, so a non-request caller (seed script, DB spec)
  // opts out with the same `skipRevalidation` flag `revalidate-collection` already honours.
  if (context?.skipRevalidation) return doc
  const elapsed = perfStart()
  console.log(`[PERF] recalcAfterChange START id=${doc.id} type=${doc.type}`)

  const registerId = resolveId(doc.sourceRegister)
  const prevRegisterId = resolveId(previousDoc?.sourceRegister)
  const targetRegisterId = resolveId(doc.targetRegister)
  const prevTargetRegisterId = resolveId(previousDoc?.targetRegister)
  const investmentId = resolveId(doc.investment)
  const prevInvestmentId = resolveId(previousDoc?.investment)

  if (registerId) revalidateTag(entityTag('cash-register', registerId), EXPIRE_NOW)
  if (prevRegisterId && prevRegisterId !== registerId)
    revalidateTag(entityTag('cash-register', prevRegisterId), EXPIRE_NOW)
  if (targetRegisterId) revalidateTag(entityTag('cash-register', targetRegisterId), EXPIRE_NOW)
  if (prevTargetRegisterId && prevTargetRegisterId !== targetRegisterId)
    revalidateTag(entityTag('cash-register', prevTargetRegisterId), EXPIRE_NOW)
  if (investmentId) revalidateTag(entityTag('investment', investmentId), EXPIRE_NOW)
  if (prevInvestmentId && prevInvestmentId !== investmentId)
    revalidateTag(entityTag('investment', prevInvestmentId), EXPIRE_NOW)

  revalidateTag(CACHE_TAGS.transfers, EXPIRE_NOW)

  console.log(`[PERF] recalcAfterChange TOTAL ${elapsed()}ms`)

  return doc
}

export const recalcAfterDelete: CollectionAfterDeleteHook = async ({ doc, context }) => {
  if (context?.skipRevalidation) return doc
  const elapsed = perfStart()
  console.log(`[PERF] recalcAfterDelete START id=${doc.id} type=${doc.type}`)

  const registerId = resolveId(doc.sourceRegister)
  const targetRegisterId = resolveId(doc.targetRegister)
  const investmentId = resolveId(doc.investment)

  if (registerId) revalidateTag(entityTag('cash-register', registerId), EXPIRE_NOW)
  if (targetRegisterId) revalidateTag(entityTag('cash-register', targetRegisterId), EXPIRE_NOW)
  if (investmentId) revalidateTag(entityTag('investment', investmentId), EXPIRE_NOW)

  // Payload hooks run in Route Handler context — must use revalidateTag, not updateTag
  revalidateTag(CACHE_TAGS.transfers, EXPIRE_NOW)

  console.log(`[PERF] recalcAfterDelete TOTAL ${elapsed()}ms`)

  return doc
}
