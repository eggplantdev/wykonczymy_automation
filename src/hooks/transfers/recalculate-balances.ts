import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, entityTag, EXPIRE_NEXT, EXPIRE_NOW } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { resolveId } from '@/lib/utils/resolve-id'

export const recalcAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  context,
}) => {
  if (context?.skipRevalidation) return doc
  const expiry = context?.deferRefresh ? EXPIRE_NEXT : EXPIRE_NOW
  const elapsed = perfStart()
  console.log(`[PERF] recalcAfterChange START id=${doc.id} type=${doc.type}`)

  const registerId = resolveId(doc.sourceRegister)
  const prevRegisterId = resolveId(previousDoc?.sourceRegister)
  const targetRegisterId = resolveId(doc.targetRegister)
  const prevTargetRegisterId = resolveId(previousDoc?.targetRegister)
  const investmentId = resolveId(doc.investment)
  const prevInvestmentId = resolveId(previousDoc?.investment)

  if (registerId) revalidateTag(entityTag('cash-register', registerId), expiry)
  if (prevRegisterId && prevRegisterId !== registerId)
    revalidateTag(entityTag('cash-register', prevRegisterId), expiry)
  if (targetRegisterId) revalidateTag(entityTag('cash-register', targetRegisterId), expiry)
  if (prevTargetRegisterId && prevTargetRegisterId !== targetRegisterId)
    revalidateTag(entityTag('cash-register', prevTargetRegisterId), expiry)
  if (investmentId) revalidateTag(entityTag('investment', investmentId), expiry)
  if (prevInvestmentId && prevInvestmentId !== investmentId)
    revalidateTag(entityTag('investment', prevInvestmentId), expiry)

  revalidateTag(CACHE_TAGS.transfers, expiry)

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

  revalidateTag(CACHE_TAGS.transfers, EXPIRE_NOW)

  console.log(`[PERF] recalcAfterDelete TOTAL ${elapsed()}ms`)

  return doc
}
