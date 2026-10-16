'use server'

import {
  investmentSchema,
  type InvestmentFormDataT,
} from '@/components/forms/investment-form/investment-schema'
import { createInvestment } from '@/lib/investments/create-investment'
import { uploadFieldIds } from '@/lib/media/upload-field'
import { validateAction, protectedAction } from './run-action'
import type { ActionResultT } from '@/types/action'

export async function promoteLeadAction(
  leadId: number,
  data: InvestmentFormDataT,
  assetIds: number[],
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

      const chosen = new Set(assetIds)
      const assets = uploadFieldIds(lead.assets).filter((id) => chosen.has(id))
      const { id, warning } = await createInvestment(payload, { ...parsed.data, assets })

      // After the investment exists, so a failure here leaves a lead that can be promoted again
      // rather than one pointing at nothing.
      await payload.update({
        collection: 'leads',
        id: leadId,
        data: { investment: id },
        overrideAccess: true,
      })

      return { success: true, warning }
    },
    ['investments', 'leads'],
  )
}
