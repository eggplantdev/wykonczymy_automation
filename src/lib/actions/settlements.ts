'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { sumEmployeeSaldo } from '@/lib/db/sum-transfers'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { uploadInvoiceFile } from '@/lib/upload-invoice'
import { perf, perfStart } from '@/lib/perf'
import {
  CreateSettlementFormT,
  createSettlementSchema,
} from '@/components/forms/settlement-form/settlement-schema'
import { type ActionResultT, getErrorMessage, validateAction } from './utils'

export async function createSettlementAction(
  data: CreateSettlementFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const elapsed = perfStart()
  const lineCount = data.lineItems?.length ?? 0
  console.log(`[PERF] createSettlementAction START lineItems=${lineCount}`)

  const session = await perf('settlement.requireAuth', () => requireAuth(MANAGEMENT_ROLES))
  if (!session.success) return session
  const { user } = session

  // Validate with server schema
  const parsed = validateAction(createSettlementSchema, data)
  if (!parsed.success) return parsed

  try {
    const payload = await perf('settlement.getPayload', () => getPayload({ config }))

    if (parsed.data.mode === 'register') {
      // Register refund: single EMPLOYEE_EXPENSE with sourceRegister
      await perf('settlement.createRegisterRefund', () =>
        payload.create({
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
        }),
      )

      revalidateCollections(['transfers'])
      console.log(`[PERF] createSettlementAction TOTAL ${elapsed()}ms (register refund)`)
      return { success: true }
    }

    // Investment/category modes: per-line-item EMPLOYEE_EXPENSE transactions

    // Upload invoice files in parallel
    const mediaIds = await perf(
      `settlement.uploadMedia (${parsed.data.lineItems.length} items)`,
      () =>
        Promise.all(
          parsed.data.lineItems.map(async (_, i) => {
            const file = invoiceFormData?.get(`invoice-${i}`) as File | null
            if (file && file.size > 0) return uploadInvoiceFile(payload, file)
            return undefined
          }),
        ),
    )

    // Create all transactions in parallel — hook handles cache revalidation
    const created = await perf(
      `settlement.createTransactions (${parsed.data.lineItems.length} items)`,
      async () => {
        const results = await Promise.all(
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
        return results.length
      },
    )

    revalidateCollections(['transfers'])

    console.log(`[PERF] createSettlementAction TOTAL ${elapsed()}ms (${created} transactions)`)

    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
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
