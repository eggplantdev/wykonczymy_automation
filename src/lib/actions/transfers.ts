'use server'

import {
  createTransferSchema,
  type CreateTransferFormT,
  createBulkTransferSchema,
  type CreateBulkTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { uploadBulkInvoices, uploadSingleInvoice } from '@/lib/upload-invoice'
import { isDepositType, needsSourceRegister } from '../constants/transfers'
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

      if (!isDepositType(parsed.data.type)) {
        const validated = await validateSourceRegister(data.sourceRegister, user, payload)
        console.log(`[PERF]   validateSourceRegister ${step()}ms`)
        if (!validated.success) return validated
        // Balance check removed — negative balances are allowed
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
      const parsed = validateAction(createBulkTransferSchema, data)
      if (!parsed.success) return parsed

      if (needsSourceRegister(parsed.data.type)) {
        const validated = await validateSourceRegister(parsed.data.sourceRegister, user, payload)
        if (!validated.success) return validated
        // Balance check removed — negative balances are allowed
        //checkIfSufficientBalance
      }

      const mediaIds = await uploadBulkInvoices(payload, invoiceFormData, lineCount)

      await Promise.all(
        parsed.data.lineItems.map((item, i) =>
          payload.create({
            collection: 'transactions',
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
              otherCategory: parsed.data.otherCategory,
              otherDescription: parsed.data.otherDescription,
              invoice: mediaIds[i],
              invoiceNote: item.invoiceNote,
              createdBy: user.id,
            },
          }),
        ),
      )

      return { success: true }
    },
    ['transfers'],
  )
}

export async function cancelTransferAction(transferId: number) {
  return withAction(
    'cancelTransferAction',
    async ({ payload, user }) => {
      const original = await payload.findByID({
        collection: 'transactions',
        id: transferId,
        depth: 0,
      })

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
      const mediaId = await uploadSingleInvoice(payload, invoiceFormData)

      await payload.update({
        collection: 'transactions',
        id: transferId,
        data: { invoice: mediaId },
      })

      return { success: true }
    },
    ['transfers'],
  )
}
