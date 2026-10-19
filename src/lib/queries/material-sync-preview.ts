'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { buildSyncPlan } from '@/lib/google/material-sync-plan'
import type { TabRowInputT } from '@/lib/google/sheets'
import {
  EXPENSES_SYNC,
  SETTLED_SYNC,
  TRANSFERS_SYNC,
  type TabSyncSpecT,
} from '@/lib/google/transfer-sheet-sync'

export type TabSyncPreviewT = {
  label: string
  toAppend: TabRowInputT[]
  toUpdateCount: number
  toRemoveCount: number
}

export type MaterialSyncPreviewT = {
  tabs: TabSyncPreviewT[]
  spreadsheetId: string
}

export async function previewMaterialSync(investmentId: number) {
  return protectedAction<MaterialSyncPreviewT>('previewMaterialSync', async ({ payload }) => {
    const sheetId = await getInvestmentSheetId(payload, investmentId)
    if (!sheetId) {
      return { success: false, error: 'Inwestycja nie ma kosztorysu.' }
    }

    const previewTabs: Array<{ label: string; spec: TabSyncSpecT }> = [
      { label: 'Wydatki', spec: EXPENSES_SYNC },
      { label: 'Transfery', spec: TRANSFERS_SYNC },
      { label: 'Rozliczone R+M', spec: SETTLED_SYNC },
    ]

    const tabs: TabSyncPreviewT[] = []
    for (const { label, spec } of previewTabs) {
      // The expenses tab has no auto-create, so a missing one must throw (the reset-button hint), not read as empty.
      const plan = await buildSyncPlan(payload, investmentId, sheetId, spec, {
        emptyIfMissing: !!spec.ensure,
      })
      tabs.push({
        label,
        toAppend: plan.toAppend,
        toUpdateCount: plan.appRows.length - plan.toAppend.length,
        toRemoveCount: plan.removableIds.length,
      })
    }

    return { success: true, data: { tabs, spreadsheetId: sheetId } }
  })
}
