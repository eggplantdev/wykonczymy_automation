'use server'

import {
  createBulkExpenseSchema,
  type CreateBulkExpenseFormT,
} from '@/components/forms/expense-form/expense-schema'
import { canMutateTransfer } from '@/lib/auth/roles'
import { perfStart } from '@/lib/perf'
import {
  cancelTransferSchema,
  createTransferSchema,
  updateTransferSchema,
  type CancelTransferFormT,
  type CreateTransferFormT,
  type UpdateTransferFormT,
} from '@/lib/schemas/transfer'
import type { SessionUserT } from '@/types/auth'
import { after } from 'next/server'
import { isLaborCost, needsSourceRegister } from '../constants/transfers'
import { syncBulkExpensesToSheet } from './sheets-sync'
import {
  // TODO: re-enable when the negative-balance constraint on auxiliary registers is brought back
  // checkIfSufficientBalance,
  validateAction,
  validateSourceRegister,
  protectedAction,
} from './utils'

export async function createTransferAction(data: CreateTransferFormT, invoiceMediaId?: number) {
  return protectedAction(
    `createTransferAction type=${data.type}`,
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(createTransferSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      if (needsSourceRegister(parsed.data.type)) {
        // For deposits, sourceRegister is actually the target (the register receiving money)
        const validated = await validateSourceRegister(data.sourceRegister, user, payload)
        console.log(`[PERF]   validateSourceRegister ${step()}ms`)
        if (!validated.success) return validated

        // TODO: negative-balance constraint on auxiliary registers temporarily dropped.
        // Re-enable this block (and the import + checkIfSufficientBalance in utils.ts) to bring it back.
        // Skip balance check for deposits (money coming in, not out) and
        // corrections (accounting adjustments, not cash withdrawals)
        // if (!isDepositType(parsed.data.type) && parsed.data.type !== 'CORRECTION') {
        //   const balanceCheck = await checkIfSufficientBalance(
        //     validated.register,
        //     data.amount,
        //     payload,
        //   )
        //   console.log(`[PERF]   checkIfSufficientBalance ${step()}ms`)
        //   if (!balanceCheck.success) return balanceCheck
        // }
      }

      const created = await payload.create({
        collection: 'transactions',
        data: {
          ...data,
          description: data.description || '',
          invoice: invoiceMediaId,
          createdBy: user.id,
        },
      })
      console.log(`[PERF]   payload.create ${step()}ms`)

      return { success: true }
    },
    ['transfers'],
  )
}

export async function createBulkTransferAction(
  data: CreateBulkExpenseFormT,
  invoiceMediaIds?: (number | undefined)[],
) {
  const lineCount = data.lineItems.length

  return protectedAction(
    `createBulkTransferAction type=${data.type} items=${lineCount}`,
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(createBulkExpenseSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      if (needsSourceRegister(parsed.data.type)) {
        // For deposits, sourceRegister is actually the target (the register receiving money)
        const validated = await validateSourceRegister(parsed.data.sourceRegister, user, payload)
        console.log(`[PERF]   validateSourceRegister ${step()}ms`)
        if (!validated.success) return validated

        // TODO: negative-balance constraint on auxiliary registers temporarily dropped.
        // Re-enable this block (and the import + checkIfSufficientBalance in utils.ts) to bring it back.
        // Skip balance check for deposits (money coming in, not out) and
        // corrections (accounting adjustments, not cash withdrawals)
        // if (!isDepositType(parsed.data.type) && parsed.data.type !== 'CORRECTION') {
        //   const totalAmount = parsed.data.lineItems.reduce((sum, item) => sum + item.amount, 0)
        //   const balanceCheck = await checkIfSufficientBalance(
        //     validated.register,
        //     totalAmount,
        //     payload,
        //   )
        //   console.log(`[PERF]   checkIfSufficientBalance ${step()}ms`)
        //   if (!balanceCheck.success) return balanceCheck
        // }
      }

      const transactionId = await payload.db.beginTransaction()
      if (!transactionId) throw new Error('Failed to start transaction')
      // skipSheetSync: the per-row afterChange hook must NOT sync each created
      // row one-by-one — this action batches them all in a single sheet write below
      // (review T4.2). The flag rides on req.context, which Payload passes to hooks.
      const req = { transactionID: transactionId, context: { skipSheetSync: true } }

      const createdIds: number[] = []
      try {
        for (let i = 0; i < parsed.data.lineItems.length; i++) {
          const item = parsed.data.lineItems[i]
          const created = await payload.create({
            collection: 'transactions',
            req,
            data: {
              description: item.description,
              amount: item.amount,
              date: parsed.data.date,
              type: parsed.data.type,
              paymentMethod: parsed.data.paymentMethod,
              sourceRegister: parsed.data.sourceRegister,
              targetRegister: parsed.data.targetRegister,
              investment: parsed.data.investment,
              worker: parsed.data.worker,
              expenseCategory: item.expenseCategory,
              otherCategory: item.category,
              invoice: invoiceMediaIds?.[i],
              invoiceNote: item.invoiceNote,
              createdBy: user.id,
            },
          })
          createdIds.push(created.id)
        }
        await payload.db.commitTransaction(transactionId)
      } catch (err) {
        await payload.db.rollbackTransaction(transactionId)
        throw err
      }
      console.log(`[PERF]   payload.create x${lineCount} ${step()}ms`)

      // Post-response sync after commit — never before, else a rolled-back row would
      // leak into the sheet. One batched call for all created rows (read the sheet
      // once, write once) instead of N serialized single-transfer syncs (review T4.2).
      // `after()` keeps the function alive past the response on Vercel.
      after(() => syncBulkExpensesToSheet(createdIds))

      return { success: true }
    },
    ['transfers'],
  )
}

type AuthErrorT = { error: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthSuccessT = { original: any }

async function fetchAndAuthorize(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  user: SessionUserT,
  transferId: number,
  errorVerb: string,
): Promise<AuthErrorT | AuthSuccessT> {
  const original = await payload.findByID({
    collection: 'transactions',
    id: transferId,
    depth: 0,
  })

  if (!original) return { error: 'Transakcja nie istnieje.' }
  if (original.cancelled) return { error: 'Transakcja jest już anulowana.' }
  if (original.type === 'CANCELLATION') return { error: 'Nie można edytować anulowania.' }

  const creatorId =
    typeof original.createdBy === 'number' ? original.createdBy : original.createdBy?.id
  const allowed = canMutateTransfer({
    role: user.role,
    userId: user.id,
    transferType: original.type,
    createdById: creatorId,
  })
  if (!allowed) {
    return { error: `Nie masz uprawnień do ${errorVerb} tej transakcji.` }
  }

  return { original }
}

export async function cancelTransferAction(transferId: number, data: CancelTransferFormT) {
  return protectedAction(
    'cancelTransferAction',
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(cancelTransferSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      const result = await fetchAndAuthorize(payload, user, transferId, 'anulowania')
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      if ('error' in result) return { success: false, error: result.error }
      const { original } = result

      // Mark original as cancelled (triggers recalcAfterChange hook)
      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { cancelled: true },
      })
      console.log(`[PERF]   update cancelled ${step()}ms`)

      // Create CANCELLATION audit row
      const today = new Date().toISOString().split('T')[0]
      const cancellation = await payload.create({
        collection: 'transactions',
        data: {
          type: 'CANCELLATION',
          amount: original.amount,
          date: today,
          description: `Anulowanie transakcji #${transferId}\n${parsed.data.reason}`,
          paymentMethod: original.paymentMethod,
          cancelledTransaction: transferId,
          createdBy: user.id,
        },
      })
      console.log(`[PERF]   create CANCELLATION ${step()}ms`)

      // The kosztorys sheet row is removed by the collection afterChange hook, which
      // fires on the `cancelled: true` update above (review T2.2) — no action-level
      // sync here, or it would double the work.

      return { success: true }
    },
    ['transfers'],
  )
}

export async function updateTransferAction(
  transferId: number,
  data: UpdateTransferFormT,
  invoiceMediaId?: number,
) {
  return protectedAction(
    'updateTransferAction',
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(updateTransferSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      const result = await fetchAndAuthorize(payload, user, transferId, 'edycji')
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      if ('error' in result) return { success: false, error: result.error }
      const { original } = result

      // Only LABOR_COST transfers can have their amount edited
      const { amount, ...fields } = parsed.data
      const newAmount = isLaborCost(original.type) ? amount : undefined
      const amountChanged = newAmount !== undefined && newAmount !== original.amount

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: {
          ...fields,
          ...(newAmount !== undefined && { amount: newAmount }),
          ...(invoiceMediaId !== undefined && { invoice: invoiceMediaId }),
          updatedBy: user.id,
        },
      })

      if (amountChanged) {
        await payload.create({
          collection: 'amount-edits',
          data: {
            transaction: transferId,
            previousAmount: original.amount,
            newAmount,
            editedBy: user.id,
          },
        })
      }
      console.log(`[PERF]   payload.update(${transferId}) ${step()}ms`)

      // Materiały sheet sync (including the move-to-another-investment case) runs from
      // the collection afterChange hook, which compares previousDoc/doc from the DB —
      // so it's correct even when the edit omits the investment field (review T2.2 +
      // closes T2.3), and it covers admin-panel edits. No action-level sync here.

      return { success: true }
    },
    ['transfers'],
  )
}

export async function updateTransferInvoiceAction(transferId: number, invoiceMediaId: number) {
  return protectedAction(
    'updateTransferInvoiceAction',
    async ({ payload }) => {
      const step = perfStart()

      const transfer = await payload.findByID({
        collection: 'transactions',
        id: transferId,
        depth: 0,
      })
      const oldMediaId = typeof transfer.invoice === 'number' ? transfer.invoice : null
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { invoice: invoiceMediaId },
      })
      console.log(`[PERF]   payload.update(${transferId}) ${step()}ms`)

      if (oldMediaId) {
        payload.delete({ collection: 'media', id: oldMediaId }).catch(console.error)
      }

      return { success: true }
    },
    ['transfers'],
  )
}

export async function removeTransferInvoiceAction(transferId: number) {
  return protectedAction(
    'removeTransferInvoiceAction',
    async ({ payload }) => {
      const step = perfStart()

      const transfer = await payload.findByID({
        collection: 'transactions',
        id: transferId,
        depth: 0,
      })

      const mediaId = typeof transfer.invoice === 'number' ? transfer.invoice : null
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { invoice: null },
      })
      console.log(`[PERF]   clear invoice field ${step()}ms`)

      if (mediaId) {
        payload.delete({ collection: 'media', id: mediaId }).catch(console.error)
      }

      return { success: true }
    },
    ['transfers'],
  )
}
