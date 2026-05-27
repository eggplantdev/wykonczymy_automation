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
import { isDepositType, isLaborCost, needsSourceRegister } from '../constants/transfers'
import {
  removeTransferFromSheet,
  syncBulkExpensesToSheet,
  syncSingleTransferToSheet,
} from './sheets-sync'
import {
  checkIfSufficientBalance,
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

        // Skip balance check for deposits (money coming in, not out) and
        // corrections (accounting adjustments, not cash withdrawals)
        if (!isDepositType(parsed.data.type) && parsed.data.type !== 'CORRECTION') {
          const balanceCheck = await checkIfSufficientBalance(
            validated.register,
            data.amount,
            payload,
          )
          console.log(`[PERF]   checkIfSufficientBalance ${step()}ms`)
          if (!balanceCheck.success) return balanceCheck
        }
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

      // Post-response Materiały sync via `after()` — runs after the user-visible
      // action returns (so Google Sheets latency never blocks it) but the runtime
      // keeps the function alive to finish it, unlike a bare `void` that Vercel can
      // freeze/kill on return. Drift is still recoverable via the sync button.
      after(() => syncSingleTransferToSheet({ transferId: created.id }))

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

        // Skip balance check for deposits (money coming in, not out) and
        // corrections (accounting adjustments, not cash withdrawals)
        if (!isDepositType(parsed.data.type) && parsed.data.type !== 'CORRECTION') {
          const totalAmount = parsed.data.lineItems.reduce((sum, item) => sum + item.amount, 0)
          const balanceCheck = await checkIfSufficientBalance(
            validated.register,
            totalAmount,
            payload,
          )
          console.log(`[PERF]   checkIfSufficientBalance ${step()}ms`)
          if (!balanceCheck.success) return balanceCheck
        }
      }

      const transactionId = await payload.db.beginTransaction()
      if (!transactionId) throw new Error('Failed to start transaction')
      const req = { transactionID: transactionId }

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

      // Remove the cancelled expense's row from its kosztorys sheet (the sheet
      // mirrors ACTIVE expenses). syncSingleTransferToSheet routes the CANCELLATION
      // to a row removal. Post-response via `after()`; logged only.
      after(() => syncSingleTransferToSheet({ transferId: cancellation.id }))

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

      // Post-response Materiały sync for synced expenses. If the investment changed,
      // drop the stale row from the OLD sheet first, then push to the current sheet
      // (append on the new sheet, or update in place if unchanged). after() keeps the
      // work alive past the response on Vercel; failures are non-fatal.
      if (original.type === 'INVESTMENT_EXPENSE') {
        const originalInvestment = (original as { investment?: number | { id?: number } })
          .investment
        const oldInvestmentId =
          typeof originalInvestment === 'number' ? originalInvestment : originalInvestment?.id
        const newInvestmentId = fields.investment
        after(async () => {
          if (
            oldInvestmentId !== undefined &&
            newInvestmentId !== undefined &&
            oldInvestmentId !== newInvestmentId
          ) {
            await removeTransferFromSheet({ transferId, investmentId: oldInvestmentId })
          }
          await syncSingleTransferToSheet({ transferId })
        })
      }

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
