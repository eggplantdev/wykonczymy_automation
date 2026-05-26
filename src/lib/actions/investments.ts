'use server'

import { createKosztorysFromTemplate } from '@/lib/google/drive'
import { investmentSchema, type InvestmentFormDataT } from '@/lib/schemas/investment'
import { validateAction, protectedAction } from './utils'

export async function createInvestmentAction(data: InvestmentFormDataT) {
  return protectedAction(
    'createInvestmentAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      const created = await payload.create({
        collection: 'investments',
        data: parsed.data,
      })

      // Fire-and-forget Drive provisioning. The investment create succeeds even
      // if Drive is down, the template was deleted, or the SA lost access — the
      // banner from Task 9 will surface the missing googleSheetId and offer a
      // manual retry via provisionKosztorysAction below.
      void (async () => {
        try {
          const { sheetId } = await createKosztorysFromTemplate(created.name)
          await payload.update({
            collection: 'investments',
            id: created.id,
            data: { googleSheetId: sheetId },
            overrideAccess: true,
          })
          console.log(`[kosztorys-provision] investment #${created.id} → sheet provisioned`)
        } catch (err) {
          console.error(`[kosztorys-provision] investment #${created.id} failed (non-fatal):`, err)
        }
      })()

      return { success: true }
    },
    ['investments'],
  )
}

/**
 * Manual counterpart to the auto-provision in createInvestmentAction. Wired to
 * the "Utwórz nowy kosztorys" CTA on the no-sheet banner (Task 9). Synchronous
 * — the user is staring at a button, so we wait for Drive to land before
 * returning so the UI can refresh and show the iframe.
 */
export async function provisionKosztorysAction(investmentId: number) {
  return protectedAction<{ sheetId: string }>(
    'provisionKosztorysAction',
    async ({ payload }) => {
      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        overrideAccess: true,
      })
      if (!investment) return { success: false, error: 'Inwestycja nie istnieje.' }
      if (investment.googleSheetId) {
        return { success: false, error: 'Ta inwestycja ma już powiązany arkusz.' }
      }

      const { sheetId } = await createKosztorysFromTemplate(investment.name)
      await payload.update({
        collection: 'investments',
        id: investmentId,
        data: { googleSheetId: sheetId },
        overrideAccess: true,
      })

      return { success: true, data: { sheetId } }
    },
    ['investments'],
  )
}

export async function updateInvestmentAction(id: number, data: InvestmentFormDataT) {
  return protectedAction(
    'updateInvestmentAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      await payload.update({
        collection: 'investments',
        id,
        data: parsed.data,
      })

      return { success: true }
    },
    ['investments'],
  )
}
