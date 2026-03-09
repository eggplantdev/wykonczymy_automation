'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { sumFilteredByType, deriveWorkerBreakdown } from '@/lib/db/sum-transfers'
import { WORKER_SALDO_TYPES } from '@/lib/constants/transfers'
import { uploadBulkInvoices } from '@/lib/upload-invoice'
import {
  CreateSettlementFormT,
  createSettlementSchema,
} from '@/components/forms/settlement-form/settlement-schema'
import { perfStart } from '@/lib/perf'
import { validateAction, withAction } from './utils'

export async function createSettlementAction(
  data: CreateSettlementFormT,
  invoiceFormData: FormData | null,
) {
  const lineCount = data.lineItems?.length ?? 0

  return withAction(
    `createSettlementAction items=${lineCount}`,
    async ({ payload, user }) => {
      const step = perfStart()

      const parsed = validateAction(createSettlementSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      if (parsed.data.mode === 'register') {
        // Register refund: single EMPLOYEE_EXPENSE with sourceRegister
        await payload.create({
          collection: 'transactions',
          data: {
            description: parsed.data.description || 'Zwrot do kasy',
            amount: parsed.data.amount!,
            date: parsed.data.date,
            type: 'EMPLOYEE_EXPENSE',
            paymentMethod: parsed.data.paymentMethod,
            sourceRegister: parsed.data.sourceRegister,
            worker: parsed.data.worker,
            createdBy: user.id,
          },
        })
        console.log(`[PERF]   payload.create (register refund) ${step()}ms`)

        return { success: true }
      }

      // Investment/category modes: per-line-item EMPLOYEE_EXPENSE transactions

      const mediaIds = await uploadBulkInvoices(
        payload,
        invoiceFormData,
        parsed.data.lineItems.length,
      )
      console.log(`[PERF]   uploadBulkInvoices ${step()}ms (${parsed.data.lineItems.length} files)`)

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
              type: 'EMPLOYEE_EXPENSE',
              paymentMethod: parsed.data.paymentMethod,
              investment: parsed.data.mode === 'investment' ? parsed.data.investment : undefined,
              expenseCategory:
                parsed.data.mode === 'investment' ? parsed.data.expenseCategory : undefined,
              worker: parsed.data.worker,
              invoice: mediaIds[i],
              invoiceNote: parsed.data.invoiceNote,
              otherCategory: parsed.data.mode === 'category' ? item.category : undefined,
              otherDescription: parsed.data.mode === 'category' ? item.note : undefined,
              createdBy: user.id,
            },
          })
        }
        await payload.db.commitTransaction(transactionId)
      } catch (err) {
        await payload.db.rollbackTransaction(transactionId)
        throw err
      }
      console.log(`[PERF]   payload.create x${parsed.data.lineItems.length} ${step()}ms`)

      return { success: true }
    },
    ['transfers'],
  )
}

export async function getManagementEmployeeSaldo(workerId: number): Promise<{ saldo: number }> {
  const step = perfStart()

  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Brak uprawnień')
  console.log(`[PERF]   requireAuth ${step()}ms`)

  // Bypass cache — this is an on-demand fetch from the settlement dialog
  // and must always return fresh data.
  const payload = await getPayload({ config })
  console.log(`[PERF]   getPayload ${step()}ms`)

  const byType = await sumFilteredByType(payload, {
    worker: { equals: workerId },
    type: { in: WORKER_SALDO_TYPES },
  })
  const saldo = deriveWorkerBreakdown(byType).periodSaldo
  console.log(`[PERF] getManagementEmployeeSaldo(${workerId}) saldo=${saldo} ${step()}ms`)

  return { saldo }
}
