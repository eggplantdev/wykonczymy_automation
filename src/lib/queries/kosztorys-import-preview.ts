'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { getInvestmentSheet, MISSING_SHEET } from '@/lib/google/sheet-lookup'
import type { ImportReportT } from '@/lib/kosztorys/sheet-import/build-import-plan'
import type { SheetFailureT } from '@/lib/kosztorys/sheet-import/classify-sheet-failure'
import {
  derivePlan,
  emptyReport,
  NO_COLUMNS,
  toSheetFailure,
} from '@/lib/kosztorys/sheet-import/read-import-plan'
import type { UnresolvedColumnsT } from '@/lib/kosztorys/sheet-import/resolve-columns'
import type { ActionResultT } from '@/types/action'

export type ImportPreviewT = {
  report: ImportReportT
  problems: string[]
  columns: UnresolvedColumnsT
  failure: SheetFailureT | null
}

export async function previewKosztorysImport(
  investmentId: number,
): Promise<ActionResultT<ImportPreviewT>> {
  return protectedAction<ImportPreviewT>('previewKosztorysImport', async ({ payload }) => {
    const sheet = await getInvestmentSheet(payload, investmentId)
    if (!sheet) return { success: false, error: MISSING_SHEET }

    try {
      const plan = await derivePlan(investmentId, sheet)
      const columns = {
        missingFields: plan.missingFields,
        candidates: plan.candidates,
        pointedFields: plan.pointedFields,
      }
      return plan.ok
        ? { success: true, data: { report: plan.report, problems: [], columns, failure: null } }
        : {
            success: true,
            data: { report: emptyReport(), problems: plan.problems, columns, failure: null },
          }
    } catch (error) {
      return {
        success: true,
        data: {
          report: emptyReport(),
          problems: [],
          columns: NO_COLUMNS,
          failure: toSheetFailure(error),
        },
      }
    }
  })
}
