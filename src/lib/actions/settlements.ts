'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { sumEmployeeSaldo } from '@/lib/db/sum-transfers'
import { uploadBulkInvoices } from '@/lib/upload-invoice'
import {
  CreateSettlementFormT,
  createSettlementSchema,
} from '@/components/forms/settlement-form/settlement-schema'
import { validateAction, withAction } from './utils'

export async function createSettlementAction(
  data: CreateSettlementFormT,
  invoiceFormData: FormData | null,
) {
  const lineCount = data.lineItems?.length ?? 0

  return withAction(
    `createSettlementAction items=${lineCount}`,
    async ({ payload, user }) => {
      const parsed = validateAction(createSettlementSchema, data)
      if (!parsed.success) return parsed

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

        return { success: true }
      }

      // Investment/category modes: per-line-item EMPLOYEE_EXPENSE transactions

      const mediaIds = await uploadBulkInvoices(
        payload,
        invoiceFormData,
        parsed.data.lineItems.length,
      )

      await Promise.all(
        parsed.data.lineItems.map((item, i) =>
          payload.create({
            collection: 'transactions',
            data: {
              description: item.description,
              amount: item.amount,
              date: parsed.data.date,
              type: 'EMPLOYEE_EXPENSE',
              paymentMethod: parsed.data.paymentMethod,
              investment: parsed.data.mode === 'investment' ? parsed.data.investment : undefined,
              worker: parsed.data.worker,
              invoice: mediaIds[i],
              invoiceNote: parsed.data.invoiceNote,
              otherCategory: parsed.data.mode === 'category' ? item.category : undefined,
              otherDescription: parsed.data.mode === 'category' ? item.note : undefined,
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

export async function getManagementEmployeeSaldo(workerId: number): Promise<{ saldo: number }> {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Brak uprawnień')

  // Bypass cache — this is an on-demand fetch from the settlement dialog
  // and must always return fresh data.
  const payload = await getPayload({ config })
  const saldo = await sumEmployeeSaldo(payload, workerId)
  return { saldo }
}
