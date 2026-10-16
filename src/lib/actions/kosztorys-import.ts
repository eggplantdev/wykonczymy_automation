'use server'

import { investmentAction } from '@/lib/actions/investment-action'
import { protectedAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { listCatalogueIdentitiesByMatchKey } from '@/lib/db/work-catalogue'
import type { CatalogueIdentityT } from '@/lib/kosztorys/work-catalogue/types'
import { setSheetMeasuredQty } from '@/lib/db/kosztorys-sheet-measured-qty'
import { getInvestmentSheet, MISSING_SHEET, type InvestmentSheetT } from '@/lib/google/sheet-lookup'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import {
  buildImportPlan,
  type ImportPlanT,
  type ImportReportT,
  type StageDefaultsT,
} from '@/lib/kosztorys/sheet-import/build-import-plan'
import { buildMeasuredQtyRefresh } from '@/lib/kosztorys/sheet-import/build-measured-qty-refresh'
import {
  buildSheetComparison,
  type SheetComparisonT,
} from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import {
  resolveLaborColumns,
  type UnresolvedColumnsT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'
import {
  classifySheetFailure,
  type SheetFailureReasonT,
  type SheetFailureT,
} from '@/lib/kosztorys/sheet-import/classify-sheet-failure'
import { readImportGrids, LABOR_TAB } from '@/lib/kosztorys/sheet-import/read-sheet'
import { getReadonlySheetsClient } from '@/lib/google/readonly-sheets-client'
import { serviceAccountEmail } from '@/lib/google/sheet-access'
import type { ActionResultT } from '@/types/action'

const PRE_IMPORT_LABEL = 'Przed importem z arkusza Google'

export type ImportPreviewT = {
  report: ImportReportT
  problems: string[]
  columns: UnresolvedColumnsT
  failure: SheetFailureT | null
}

export type RefreshMeasuredQtyResultT = {
  updated: number
  cleared: number
  unmatched: number
}

export type SheetCompareResultT = {
  comparison: SheetComparisonT | null
  refresh: RefreshMeasuredQtyResultT | null
  problems: string[]
  columns: UnresolvedColumnsT
  failure: SheetFailureT | null
}

export type ApplyImportResultT = {
  sections: number
  items: number
  stages: number
  droppedWorkerAssignments: number
}

async function derivePlan(
  investmentId: number,
  sheet: InvestmentSheetT,
  stageDefaults?: StageDefaultsT,
  catalogue?: ReadonlyMap<string, CatalogueIdentityT>,
): Promise<ImportPlanT> {
  const grids = await readImportGrids(getReadonlySheetsClient(), sheet.googleSheetId)
  return buildImportPlan(
    grids,
    await serializeKosztorys(investmentId),
    sheet.sheetColumnMapping,
    stageDefaults,
    catalogue,
  )
}

const FAILURE_MESSAGES: Record<SheetFailureReasonT, string> = {
  forbidden: 'Arkusz Google nie jest udostępniony kontu usługi tej aplikacji.',
  'not-found': 'Arkusz Google o tym identyfikatorze nie istnieje albo został usunięty.',
  'missing-tab': `Arkusz Google nie ma zakładki „${LABOR_TAB}".`,
  unknown: 'Nie udało się odczytać arkusza Google. Spróbuj ponownie za chwilę.',
}

function toSheetFailure(error: unknown): SheetFailureT {
  const reason = classifySheetFailure(error)
  if (reason === 'unknown') {
    // TODO(EX-958) SENTRY-REQUIRED: capture the underlying Google error, not just the console line.
    console.error('[kosztorys-import] sheet read failed', error)
  }
  return { reason, serviceAccountEmail: reason === 'forbidden' ? serviceAccountEmail() : null }
}

function sheetFailureMessage(error: unknown): string {
  return FAILURE_MESSAGES[toSheetFailure(error).reason]
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

const NO_COLUMNS: UnresolvedColumnsT = { missingFields: [], candidates: [], pointedFields: [] }

function emptyReport(): ImportReportT {
  return {
    missingColumns: [],
    counts: { sections: 0, items: 0, stages: 0 },
    rateDecisions: [],
    coeffs: { wTools: null, ownTools: null },
    dropped: [],
    totals: [],
    warnings: [],
  }
}

/**
 * that refresh is an `UPDATE kosztorys_items`, so on a
 * zakończona inwestycja this is a write wearing a comparison's name.
 */
export async function compareWithSheet(
  investmentId: number,
): Promise<ActionResultT<SheetCompareResultT>> {
  return investmentAction<SheetCompareResultT>(
    'compareWithSheet',
    { investmentId },
    async ({ payload }) => {
      const sheet = await getInvestmentSheet(payload, investmentId)
      if (!sheet) return { success: false, error: MISSING_SHEET }

      let grids: Awaited<ReturnType<typeof readImportGrids>>
      // Outside the try on purpose: this one reads the database, and the catch below translates
      // every failure into „nie udało się odczytać arkusza Google", which would blame the wrong
      // system
      const treeBeforeWrite = await serializeKosztorys(investmentId)
      try {
        grids = await readImportGrids(getReadonlySheetsClient(), sheet.googleSheetId)
      } catch (error) {
        return {
          success: true,
          data: {
            comparison: null,
            refresh: null,
            problems: [],
            columns: NO_COLUMNS,
            failure: toSheetFailure(error),
          },
        }
      }

      const resolved = resolveLaborColumns(grids.laborGrid, sheet.sheetColumnMapping)
      const columns = {
        missingFields: resolved.missingFields,
        candidates: resolved.candidates,
        pointedFields: resolved.pointedFields,
      }
      if (!resolved.ok) {
        return {
          success: true,
          data: {
            comparison: null,
            refresh: null,
            problems: resolved.problems,
            columns,
            failure: null,
          },
        }
      }

      const refreshed = buildMeasuredQtyRefresh(grids, treeBeforeWrite, sheet.sheetColumnMapping)
      if (!refreshed.ok) return { success: false, error: refreshed.problems.join(' ') }
      const { rows, unmatched } = refreshed.refresh
      const written = await setSheetMeasuredQty(await getDb(payload), investmentId, rows)

      const tree = written > 0 ? await serializeKosztorys(investmentId) : treeBeforeWrite
      const built = buildSheetComparison(
        grids,
        tree,
        sheet.googleSheetId,
        tree.globalDiscount,
        sheet.sheetColumnMapping,
      )
      if (!built.ok) return { success: false, error: built.problems.join(' ') }

      return {
        success: true,
        data: {
          comparison: built.comparison,
          problems: [],
          columns,
          refresh: {
            updated: rows.filter((row) => row.qty !== null).length,
            cleared: rows.filter((row) => row.qty === null).length,
            unmatched,
          },
          failure: null,
        },
      }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}

// Takes no plan from the client: it re-reads the sheet and rebuilds, so a forged preview payload
// cannot decide what gets written.
export async function applyKosztorysImport(
  investmentId: number,
  plane?: ToolPlaneT | null,
  workerId?: number | null,
): Promise<ActionResultT<ApplyImportResultT>> {
  return investmentAction<ApplyImportResultT>(
    'applyKosztorysImport',
    { investmentId },
    async ({ payload, user }) => {
      const sheet = await getInvestmentSheet(payload, investmentId)
      if (!sheet) return { success: false, error: MISSING_SHEET }

      const catalogue = await listCatalogueIdentitiesByMatchKey(await getDb(payload))
      let plan: ImportPlanT
      try {
        plan = await derivePlan(
          investmentId,
          sheet,
          {
            plane: TOOL_PLANES.includes(plane as ToolPlaneT) ? (plane as ToolPlaneT) : null,
            workerId:
              typeof workerId === 'number' && Number.isInteger(workerId) && workerId > 0
                ? workerId
                : null,
          },
          catalogue,
        )
      } catch (error) {
        return { success: false, error: sheetFailureMessage(error) }
      }
      if (!plan.ok) return { success: false, error: plan.problems.join(' ') }

      const restored = await replaceTreeWithSnapshot(payload, {
        investmentId,
        label: PRE_IMPORT_LABEL,
        takenBy: user.id,
        tree: plan.tree,
        takeSettingsFromTree: true,
      })

      return {
        success: true,
        data: {
          sections: plan.tree.sections.length,
          items: plan.tree.items.length,
          stages: plan.tree.stages.length,
          droppedWorkerAssignments: restored.droppedWorkerAssignments,
        },
      }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}
