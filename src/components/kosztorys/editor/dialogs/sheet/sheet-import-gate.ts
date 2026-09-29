import type { ImportPreviewT } from '@/lib/actions/kosztorys-import'
import {
  footerDisagreements,
  type FooterComparisonT,
} from '@/lib/kosztorys/sheet-import/footer-totals'

export type ImportGateT = {
  confirmDisabled: boolean
  // Summary rows where the sheet disagrees with itself — surfaced, never blocking. A row we could
  // not find at all is NOT one of these: it is a sheet with no such summary row, which says nothing
  // about whether the parse was right.
  mismatchedTotals: FooterComparisonT[]
}

// The one decision the preview dialog makes: may the owner press confirm? An unreadable sheet and an
// unresolved column are both refusals to read the sheet at all, so both block; a total that doesn't
// add up is the owner's own stale SUM often enough that blocking on it would disable the button
// exactly where it's needed.
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
