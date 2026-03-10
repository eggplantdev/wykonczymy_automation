'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  createTransferSchema,
  type CreateTransferFormT,
  createBulkTransferSchema,
  type CreateBulkTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole, MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { sumRegisterBalance } from '@/lib/db/sum-transfers'
import { uploadBulkInvoices, uploadSingleInvoice } from '@/lib/upload-invoice'
import { needsSourceRegister } from '../constants/transfers'
import {
  // checkIfSufficientBalance,
  validateAction,
  validateSourceRegister,
  withAction,
} from './utils'
import { perfStart } from '@/lib/perf'

export async function createTransferAction(
  data: CreateTransferFormT,
  invoiceFormData: FormData | null,
) {
  return withAction(
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
  data: CreateBulkTransferFormT,
  invoiceFormData: FormData | null,
) {
  const lineCount = data.lineItems.length

  return withAction(
    `createBulkTransferAction type=${data.type} items=${lineCount}`,
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(createBulkTransferSchema, data)
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
              expenseCategory: parsed.data.expenseCategory,
              otherCategory: item.category,
              otherDescription: item.note,
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

export async function cancelTransferAction(transferId: number) {
  return withAction(
    'cancelTransferAction',
    async ({ payload, user }) => {
      const step = perfStart()

      const original = await payload.findByID({
        collection: 'transactions',
        id: transferId,
        depth: 0,
      })
      console.log(`[PERF]   findByID(${transferId}) ${step()}ms`)

      if (!original) return { success: false, error: 'Transakcja nie istnieje.' }
      if (original.cancelled) return { success: false, error: 'Transakcja jest już anulowana.' }

      const creatorId =
        typeof original.createdBy === 'number' ? original.createdBy : original.createdBy?.id
      if (user.id !== creatorId && !isAdminOrOwnerRole(user.role)) {
        return { success: false, error: 'Nie masz uprawnień do anulowania tej transakcji.' }
      }

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

export async function updateTransferNoteAction(transferId: number, note: string) {
  return withAction('updateTransferNoteAction', async ({ payload }) => {
    await payload.update({
      collection: 'transactions',
      id: transferId,
      data: { invoiceNote: note },
    })

    return { success: true }
  })
}

export async function updateTransferInvoiceAction(transferId: number, invoiceFormData: FormData) {
  return withAction(
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
  return withAction(
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

export async function getRegisterSaldo(registerId: number): Promise<{ saldo: number }> {
  const step = perfStart()

  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Brak uprawnień')
  console.log(`[PERF]   requireAuth ${step()}ms`)

  const payload = await getPayload({ config })
  console.log(`[PERF]   getPayload ${step()}ms`)

  const saldo = await sumRegisterBalance(payload, registerId)
  console.log(`[PERF] getRegisterSaldo(${registerId}) saldo=${saldo} ${step()}ms`)

  return { saldo }
}
