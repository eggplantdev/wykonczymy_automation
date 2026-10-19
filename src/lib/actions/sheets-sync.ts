'use server'

import { applyTabRowsBatch } from '@/lib/google/sheets'
import { EXPENSES_SYNC, SETTLED_SYNC, TRANSFERS_SYNC } from '@/lib/google/transfer-sheet-sync'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { buildSyncPlan } from '@/lib/google/material-sync-plan'
import { investmentAction } from '@/lib/actions/investment-action'

export type ApplyMaterialSyncResultT = {
  added: number
  updated: number
  removed: number
  errors: Array<{ transferId: number; message: string }>
}

// Re-derives what to append SERVER-SIDE — never trusts a client-supplied row set.
export async function applyMaterialSync(investmentId: number) {
  return investmentAction<ApplyMaterialSyncResultT>(
    'applyMaterialSync',
    { investmentId },
    async ({ payload }) => {
      const sheetId = await getInvestmentSheetId(payload, investmentId)
      if (!sheetId) {
        return { success: false, error: 'Inwestycja nie ma kosztorysu.' }
      }

      const results = await Promise.all(
        [EXPENSES_SYNC, TRANSFERS_SYNC, SETTLED_SYNC].map(async (spec) => {
          await spec.ensure?.(sheetId)
          const plan = await buildSyncPlan(payload, investmentId, sheetId, spec)
          return applyTabRowsBatch(sheetId, spec.cfg, plan.appRows, plan.removableIds)
        }),
      )

      return {
        success: true,
        data: {
          added: results.reduce((s, r) => s + r.added, 0),
          updated: results.reduce((s, r) => s + r.updated, 0),
          removed: results.reduce((s, r) => s + r.removed, 0),
          errors: [],
        },
      }
    },
    ['investments'],
  )
}
