'use server'

import {
  investmentSchema,
  type InvestmentFormDataT,
} from '@/components/forms/investment-form/investment-schema'
import { createInvestment } from '@/lib/investments/create-investment'
import { uploadFieldIds } from '@/lib/media/upload-field'
import { validateAction, protectedAction } from './run-action'
import type { ActionResultT } from '@/types/action'

/**
 * Turn a zgłoszenie into an inwestycja, carrying its files across as a relation.
 *
 * **The bytes are not copied.** Both rows point at the same `media` ids — the whole reason media is
 * one shared collection — and the prevent-delete guard is what makes that safe: deleting the lead
 * afterwards no longer strips the investment's photos.
 *
 * Never automatic: the caller is a dialog the human edits and submits, so `data` is what they
 * approved, not what the visitor typed.
 */
export async function promoteLeadAction(
  leadId: number,
  data: InvestmentFormDataT,
): Promise<ActionResultT> {
  return protectedAction(
    'promoteLeadAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      const lead = await payload.findByID({
        collection: 'leads',
        id: leadId,
        depth: 0,
        overrideAccess: true,
      })
      if (lead.investment) {
        return { success: false, error: 'To zgłoszenie ma już swoją inwestycję.' }
      }

      const assets = uploadFieldIds(lead.assets)
      const { id, warning } = await createInvestment(payload, { ...parsed.data, assets })

      // After the investment exists, so a failure here leaves a lead that can be promoted again
      // rather than one pointing at nothing.
      await payload.update({
        collection: 'leads',
        id: leadId,
        data: { investment: id, contactStatus: 'contacted' },
        overrideAccess: true,
      })

      return { success: true, warning }
    },
    ['investments', 'leads'],
  )
}
