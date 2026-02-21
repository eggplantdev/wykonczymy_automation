'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { sql } from '@payloadcms/db-vercel-postgres'

import { getDb, sumInvestmentCosts, sumInvestmentIncome } from '@/lib/db/sum-transfers'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { uploadInvoiceFile } from '@/lib/media/upload-invoice'
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

    // Create all transactions in parallel, skipping hooks (single recalc at end)
    // EMPLOYEE_EXPENSE has no cashRegister — register balance unaffected
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
              context: { skipBalanceRecalc: true },
            }),
          ),
        )
        return results.length
      },
    )

    // Single recalculation for investment financials (no register involved for EMPLOYEE_EXPENSE)
    await perf('settlement.recalcBalances', async () => {
      if (parsed.data.investment) {
        const db = await getDb(payload)
        const investmentId = parsed.data.investment
        const [totalCosts, totalIncome] = await Promise.all([
          sumInvestmentCosts(payload, investmentId),
          sumInvestmentIncome(payload, investmentId),
        ])
        await db.execute(sql`
          UPDATE investments
          SET total_costs = ${totalCosts}, total_income = ${totalIncome}, updated_at = NOW()
          WHERE id = ${investmentId}
        `)
      }
    })

    revalidateCollections(['transfers', 'cashRegisters'])

    console.log(`[PERF] createSettlementAction TOTAL ${elapsed()}ms (${created} transactions)`)

    return { success: true }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
