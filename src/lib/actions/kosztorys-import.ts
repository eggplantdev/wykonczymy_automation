'use server'

import { investmentAction } from '@/lib/actions/investment-action'
import { protectedAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { setSheetMeasuredQty } from '@/lib/db/kosztorys-sheet-measured-qty'
import { getInvestmentSheet, MISSING_SHEET, type InvestmentSheetT } from '@/lib/google/sheet-lookup'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import {
  buildImportPlan,
  type ImportPlanT,
  type ImportReportT,
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
  // What the owner may point a field at. Filled on a refused read and on a resolved one alike: an
  // optional column nobody recognised is the same pick, made with the import still available.
  columns: UnresolvedColumnsT
  failure: SheetFailureT | null
}

export type RefreshMeasuredQtyResultT = {
  updated: number
  cleared: number
  unmatched: number
}

// Both halves are null whenever `failure` is set or `problems` is non-empty: the comparison
// describes a read that did not happen, and the refresh is deliberately skipped — writing a figure
// off a sheet we could not read would be worse than leaving the stored one alone.
export type SheetCompareResultT = {
  comparison: SheetComparisonT | null
  refresh: RefreshMeasuredQtyResultT | null
  // An unreadable header travels as data here for the same reason a failed read does: this window is
  // where the owner points at the column, and a red toast has nowhere to put the pick.
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

// Reading the sheet and merging it with the current tree — the single derivation both actions run,
// so the preview can never describe an import different from the one apply performs.
async function derivePlan(
  investmentId: number,
  sheet: InvestmentSheetT,
  plane: ToolPlaneT | null = null,
): Promise<ImportPlanT> {
  const grids = await readImportGrids(getReadonlySheetsClient(), sheet.googleSheetId)
  return buildImportPlan(
    grids,
    await serializeKosztorys(investmentId),
    sheet.sheetColumnMapping,
    plane,
  )
}

const FAILURE_MESSAGES: Record<SheetFailureReasonT, string> = {
  forbidden: 'Arkusz Google nie jest udostępniony kontu usługi tej aplikacji.',
  'not-found': 'Arkusz Google o tym identyfikatorze nie istnieje albo został usunięty.',
  'missing-tab': `Arkusz Google nie ma zakładki „${LABOR_TAB}".`,
  unknown: 'Nie udało się odczytać arkusza Google. Spróbuj ponownie za chwilę.',
}

// Google's own errors are English, unactionable („The caller does not have permission") and would
// land in a Polish toast — so the reason is translated here. Only a genuine outage is logged: a
// sheet nobody shared is not a fault worth reporting, it is a thing the owner has to do.
function toSheetFailure(error: unknown): SheetFailureT {
  const reason = classifySheetFailure(error)
  if (reason === 'unknown') {
    // TODO(EX-449) SENTRY-REQUIRED: capture the underlying Google error, not just the console line.
    console.error('[kosztorys-import] sheet read failed', error)
  }
  return { reason, serviceAccountEmail: reason === 'forbidden' ? serviceAccountEmail() : null }
}

// „Pobierz i zastąp" has nothing to render — it refuses the write and says why in one sentence.
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
      // The tree stays on the server: the browser has no use for it, and shipping it would invite a
      // round-trip that apply would have to distrust anyway.
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

// A sheet that never arrived says nothing about its columns — no field is missing and no column is a
// candidate, because there was no header to read.
const NO_COLUMNS: UnresolvedColumnsT = { missingFields: [], candidates: [], pointedFields: [] }

// A failed resolution still renders a dialog, so the preview needs a report shape to render nothing
// with — the problems list is what the owner reads and the confirm button is what it disables.
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
 * „Porównaj z arkuszem" — a live read that also refreshes the stored reference quantity, in one pass.
 *
 * The refresh is not a decision: the stored figure is a copy of the sheet's Pomiar, so once the sheet
 * has been read live, „keep the stale copy" is not an answer anybody would pick (owner, 2026-08-14).
 * Folding it in here also keeps it to ONE sheet read — two actions each calling `readImportGrids`
 * would have doubled the Google round-trip for a single open.
 *
 * Lives here rather than in `lib/queries` (where an on-demand client read normally belongs) because
 * it shares `getInvestmentSheetId`, `readImportGrids` and `sheetFailureMessage` with the import pair
 * above — splitting them would duplicate the failure-message translation and give the two
 * sheet-reading dialogs two different error shapes.
 *
 * Gated like an import, not like a read: that refresh is an `UPDATE kosztorys_items`, so on a
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
      // system and hand the owner retry advice that cannot help.
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

      // Resolved here rather than left to the two builders below: an unreadable header has to reach
      // the window as a pick, and the refresh must not run on it — writing a Pomiar off a header we
      // could not read would be worse than leaving the stored figure alone.
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

      // Re-read rather than reuse the pre-write tree, so the comparison describes the state the
      // write left behind. It happens to be identical today — no figure reported here derives from
      // the stored reference quantity — but that is an invariant of the current report, not of the
      // action, and the day a figure starts reading it this would go quietly stale.
      const tree = written > 0 ? await serializeKosztorys(investmentId) : treeBeforeWrite
      // Costs no query: `serializeKosztorys` just read the same cached tree and dropped this field.
      const { globalDiscount } = await getKosztorysTree(investmentId)
      const built = buildSheetComparison(
        grids,
        tree,
        sheet.googleSheetId,
        globalDiscount,
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
  // Anything but the two planes is read as „nie ustawiaj" rather than refused: a client sending
  // nonsense here asks for undecided etapy, which is what an import without a pick produces anyway.
  plane?: ToolPlaneT | null,
): Promise<ActionResultT<ApplyImportResultT>> {
  return investmentAction<ApplyImportResultT>(
    'applyKosztorysImport',
    { investmentId },
    async ({ payload, user }) => {
      const sheet = await getInvestmentSheet(payload, investmentId)
      if (!sheet) return { success: false, error: MISSING_SHEET }

      let plan: ImportPlanT
      try {
        plan = await derivePlan(
          investmentId,
          sheet,
          TOOL_PLANES.includes(plane as ToolPlaneT) ? (plane as ToolPlaneT) : null,
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
