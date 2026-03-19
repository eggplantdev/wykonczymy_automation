'use server'

import {
  createBulkExpenseSchema,
  type CreateBulkExpenseFormT,
} from '@/components/forms/expense-form/expense-schema'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { perfStart } from '@/lib/perf'
import {
  createTransferSchema,
  updateTransferSchema,
  type CreateTransferFormT,
  type UpdateTransferFormT,
} from '@/lib/schemas/transfer'
import { uploadBulkInvoices, uploadSingleInvoice } from '@/lib/upload-invoice'
import type { SessionUserT } from '@/types/auth'
import { needsSourceRegister } from '../constants/transfers'
import {
  // checkIfSufficientBalance,
  validateAction,
  validateSourceRegister,
  protectedAction,
} from './utils'

export async function createTransferAction(
  data: CreateTransferFormT,
  invoiceFormData: FormData | null,
) {
  return protectedAction(
    `createTransferAction type=${data.type}`,
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(createTransferSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      if (needsSourceRegister(parsed.data.type)) {
        const validated = await validateSourceRegister(data.sourceRegister, user, payload)
        console.log(`[PERF]   validateSourceRegister ${step()}ms`)
        if (!validated.success) return validated
        // Balance check removed — negative balances are allowed
        // checkIfSufficientBalance in utils
      }

      const mediaId = await uploadSingleInvoice(payload, invoiceFormData)
      console.log(`[PERF]   uploadSingleInvoice ${step()}ms`)

      await payload.create({
        collection: 'transactions',
        data: {
          ...data,
          description: data.description || '',
          invoice: mediaId,
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
  invoiceFormData: FormData | null,
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
        const validated = await validateSourceRegister(parsed.data.sourceRegister, user, payload)
        console.log(`[PERF]   validateSourceRegister ${step()}ms`)
        if (!validated.success) return validated
        // Balance check removed — negative balances are allowed
        //checkIfSufficientBalance
      }

      const mediaIds = await uploadBulkInvoices(payload, invoiceFormData, lineCount)
      console.log(`[PERF]   uploadBulkInvoices ${step()}ms (${lineCount} files)`)

      const transactionId = await payload.db.beginTransaction()
      if (!transactionId) throw new Error('Failed to start transaction')
      const req = { transactionID: transactionId }

      try {
        for (let i = 0; i < parsed.data.lineItems.length; i++) {
          const item = parsed.data.lineItems[i]
          await payload.create({
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
              expenseCategory: item.expenseCategory,
              otherCategory: item.category,
              invoice: mediaIds[i],
              invoiceNote: item.invoiceNote,
              createdBy: user.id,
            },
          })
        }
        await payload.db.commitTransaction(transactionId)
      } catch (err) {
        await payload.db.rollbackTransaction(transactionId)
        throw err
      }
      console.log(`[PERF]   payload.create x${lineCount} ${step()}ms`)

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
  if (user.id !== creatorId && !isAdminOrOwnerRole(user.role)) {
    return { error: `Nie masz uprawnień do ${errorVerb} tej transakcji.` }
  }

  return { original }
}

export async function cancelTransferAction(transferId: number) {
  return protectedAction(
    'cancelTransferAction',
    async ({ payload, user }) => {
      const step = perfStart()

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
      await payload.create({
        collection: 'transactions',
        data: {
          type: 'CANCELLATION',
          amount: original.amount,
          date: today,
          description: `Anulowanie transakcji #${transferId}`,
          paymentMethod: original.paymentMethod,
          cancelledTransaction: transferId,
          createdBy: user.id,
        },
      })
      console.log(`[PERF]   create CANCELLATION ${step()}ms`)

      return { success: true }
    },
    ['transfers'],
  )
}

export async function updateTransferAction(transferId: number, data: UpdateTransferFormT) {
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

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: {
          ...parsed.data,
          updatedBy: user.id,
        },
      })
      console.log(`[PERF]   payload.update(${transferId}) ${step()}ms`)

      return { success: true }
    },
    ['transfers'],
  )
}

export async function updateTransferInvoiceAction(transferId: number, invoiceFormData: FormData) {
  return protectedAction(
    'updateTransferInvoiceAction',
    async ({ payload }) => {
      const step = perfStart()

      const mediaId = await uploadSingleInvoice(payload, invoiceFormData)
      console.log(`[PERF]   uploadSingleInvoice ${step()}ms`)

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { invoice: mediaId },
      })
      console.log(`[PERF]   payload.update(${transferId}) ${step()}ms`)

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
