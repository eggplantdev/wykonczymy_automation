import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Payload,
  PayloadRequest,
} from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import {
  getDb,
  sumRegisterBalance,
  sumInvestmentCosts,
  sumInvestmentIncome,
} from '@/lib/db/sum-transfers'
import { revalidateTag } from 'next/cache'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { entityTag } from '@/lib/cache/tags'
import { INVESTMENT_TYPES } from '@/lib/constants/transfers'
import { perf, perfStart } from '@/lib/perf'

/**
 * Recalculate a cash register's balance via SQL SUM + direct UPDATE.
 *
 * IMPORTANT: `req` must be forwarded so the query runs inside the same
 * database transaction as the triggering operation, avoiding stale reads.
 */
const recalcRegisterBalance = async (
  payload: Payload,
  registerId: number,
  req: PayloadRequest,
): Promise<void> => {
  const balance = await perf(`hook.sumRegisterBalance(${registerId})`, () =>
    sumRegisterBalance(payload, registerId, req),
  )

  await perf(`hook.updateCashRegister(${registerId})`, async () => {
    const db = await getDb(payload, req)
    await db.execute(sql`
      UPDATE cash_registers SET balance = ${balance}, updated_at = NOW() WHERE id = ${registerId}
    `)
  })
}

/**
 * Recalculate an investment's totalCosts and totalIncome via SQL SUM + direct UPDATE.
 * Costs: INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE
 * Income: INVESTOR_DEPOSIT + STAGE_SETTLEMENT
 */
const recalcInvestmentFinancials = async (
  payload: Payload,
  investmentId: number,
  req: PayloadRequest,
): Promise<void> => {
  const [totalCosts, totalIncome] = await Promise.all([
    perf(`hook.sumInvestmentCosts(${investmentId})`, () =>
      sumInvestmentCosts(payload, investmentId, req),
    ),
    perf(`hook.sumInvestmentIncome(${investmentId})`, () =>
      sumInvestmentIncome(payload, investmentId, req),
    ),
  ])

  await perf(`hook.updateInvestment(${investmentId})`, async () => {
    const db = await getDb(payload, req)
    await db.execute(sql`
      UPDATE investments
      SET total_costs = ${totalCosts}, total_income = ${totalIncome}, updated_at = NOW()
      WHERE id = ${investmentId}
    `)
  })
}

/** Resolve relationship value to a numeric ID (handles populated objects). */
const resolveId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return undefined
}

/**
 * afterChange — recalculate register balance and investment costs
 * after a transaction is created or updated.
 *
 * REGISTER_TRANSFER: recalcs both source (cashRegister) and target (targetRegister).
 * EMPLOYEE_EXPENSE: registerId is undefined (no cashRegister) → naturally skipped.
 */
export const recalcAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  context,
}) => {
  const elapsed = perfStart()
  console.log(`[PERF] recalcAfterChange START id=${doc.id} type=${doc.type}`)

  if (context.skipBalanceRecalc) {
    return doc
  }

  const registerId = resolveId(doc.cashRegister)
  const prevRegisterId = resolveId(previousDoc?.cashRegister)
  const targetRegisterId = resolveId(doc.targetRegister)
  const prevTargetRegisterId = resolveId(previousDoc?.targetRegister)
  const investmentId = resolveId(doc.investment)
  const prevInvestmentId = resolveId(previousDoc?.investment)

  // Run all recalculations in parallel — they operate on independent entities
  const tasks: Promise<void>[] = []

  // Source register
  if (registerId) {
    tasks.push(recalcRegisterBalance(req.payload, registerId, req))
  }
  if (prevRegisterId && prevRegisterId !== registerId) {
    tasks.push(recalcRegisterBalance(req.payload, prevRegisterId, req))
  }

  // Target register (REGISTER_TRANSFER)
  if (targetRegisterId) {
    tasks.push(recalcRegisterBalance(req.payload, targetRegisterId, req))
  }
  if (prevTargetRegisterId && prevTargetRegisterId !== targetRegisterId) {
    tasks.push(recalcRegisterBalance(req.payload, prevTargetRegisterId, req))
  }

  // Investment costs + income
  if (investmentId && (INVESTMENT_TYPES as readonly string[]).includes(doc.type as string)) {
    tasks.push(recalcInvestmentFinancials(req.payload, investmentId, req))
  }
  if (prevInvestmentId && prevInvestmentId !== investmentId) {
    tasks.push(recalcInvestmentFinancials(req.payload, prevInvestmentId, req))
  }

  await Promise.all(tasks)

  // Revalidate entity-specific tags
  if (registerId) revalidateTag(entityTag('cash-register', registerId), 'max')
  if (prevRegisterId && prevRegisterId !== registerId)
    revalidateTag(entityTag('cash-register', prevRegisterId), 'max')
  if (targetRegisterId) revalidateTag(entityTag('cash-register', targetRegisterId), 'max')
  if (prevTargetRegisterId && prevTargetRegisterId !== targetRegisterId)
    revalidateTag(entityTag('cash-register', prevTargetRegisterId), 'max')
  if (investmentId) revalidateTag(entityTag('investment', investmentId), 'max')
  if (prevInvestmentId && prevInvestmentId !== investmentId)
    revalidateTag(entityTag('investment', prevInvestmentId), 'max')

  revalidateCollections(['transfers', 'cashRegisters', 'investments'])

  console.log(`[PERF] recalcAfterChange TOTAL ${elapsed()}ms`)

  return doc
}

/**
 * afterDelete — recalculate register balance and investment costs
 * after a transaction is deleted.
 */
export const recalcAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const elapsed = perfStart()
  console.log(`[PERF] recalcAfterDelete START id=${doc.id} type=${doc.type}`)

  const registerId = resolveId(doc.cashRegister)
  const targetRegisterId = resolveId(doc.targetRegister)
  const investmentId = resolveId(doc.investment)

  const tasks: Promise<void>[] = []

  if (registerId) {
    tasks.push(recalcRegisterBalance(req.payload, registerId, req))
  }
  if (targetRegisterId) {
    tasks.push(recalcRegisterBalance(req.payload, targetRegisterId, req))
  }
  if (investmentId && (INVESTMENT_TYPES as readonly string[]).includes(doc.type as string)) {
    tasks.push(recalcInvestmentFinancials(req.payload, investmentId, req))
  }

  await Promise.all(tasks)

  // Revalidate entity-specific tags
  if (registerId) revalidateTag(entityTag('cash-register', registerId), 'max')
  if (targetRegisterId) revalidateTag(entityTag('cash-register', targetRegisterId), 'max')
  if (investmentId) revalidateTag(entityTag('investment', investmentId), 'max')

  revalidateCollections(['transfers', 'cashRegisters', 'investments'])

  console.log(`[PERF] recalcAfterDelete TOTAL ${elapsed()}ms`)

  return doc
}
