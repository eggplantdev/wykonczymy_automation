import type { InvestmentSheetT } from '@/lib/google/sheet-lookup'
import { getReadonlySheetsClient } from '@/lib/google/readonly-sheets-client'
import { serviceAccountEmail } from '@/lib/google/sheet-access'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import type { CatalogueIdentityT } from '@/lib/kosztorys/work-catalogue/types'
import {
  buildImportPlan,
  type ImportPlanT,
  type ImportReportT,
  type StageDefaultsT,
} from '@/lib/kosztorys/sheet-import/build-import-plan'
import type { UnresolvedColumnsT } from '@/lib/kosztorys/sheet-import/resolve-columns'
import {
  classifySheetFailure,
  type SheetFailureReasonT,
  type SheetFailureT,
} from '@/lib/kosztorys/sheet-import/classify-sheet-failure'
import { readImportGrids, LABOR_TAB } from '@/lib/kosztorys/sheet-import/read-sheet'

export async function derivePlan(
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

export function toSheetFailure(error: unknown): SheetFailureT {
  const reason = classifySheetFailure(error)
  if (reason === 'unknown') {
    // TODO(EX-958) SENTRY-REQUIRED: capture the underlying Google error, not just the console line.
    console.error('[kosztorys-import] sheet read failed', error)
  }
  return { reason, serviceAccountEmail: reason === 'forbidden' ? serviceAccountEmail() : null }
}

export function sheetFailureMessage(error: unknown): string {
  return FAILURE_MESSAGES[toSheetFailure(error).reason]
}

export const NO_COLUMNS: UnresolvedColumnsT = {
  missingFields: [],
  candidates: [],
  pointedFields: [],
}

export function emptyReport(): ImportReportT {
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
