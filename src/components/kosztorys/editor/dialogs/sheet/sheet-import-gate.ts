import type { ImportPreviewT } from '@/lib/actions/kosztorys-import'
import {
  footerDisagreements,
  type FooterComparisonT,
} from '@/lib/kosztorys/sheet-import/footer-totals'

export type ImportGateT = {
  confirmDisabled: boolean
  mismatchedTotals: FooterComparisonT[]
}

// a total that doesn't add up is the owner's own stale SUM often enough that blocking on it would
// disable the button exactly where it's needed.
export function evaluateImportGate(
  preview: ImportPreviewT | null,
  loaded: boolean,
  pending: boolean,
): ImportGateT {
  return {
    confirmDisabled:
      !loaded || pending || !preview || preview.problems.length > 0 || preview.failure !== null,
    mismatchedTotals: preview ? footerDisagreements(preview.report.totals) : [],
  }
}
