'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Which view the totals panel shows — the top toggle drives it directly, fully independent of the
// grid's price view. „Podwykonawcy" and „Marża" are owner-only, filtered out of the client read-only
// view (see SummaryPanelContent).
export type SummaryViewT = 'summary' | 'expenses' | 'stages' | 'subcontractors' | 'margin'

// Persisted globally in localStorage — a reading position of the person, not of one kosztorys, same
// `table-columns:` family as the panel's axis pick. Survives refresh and the editor restore-remount.
const STORAGE_KEY = 'table-columns:kosztorys-summary-view'
// The client document keeps its own key, outside the `table-columns:` family EX-591 keeps out of the
// client's grid: the owner's last tab still cannot decide which panel that document opens on, while a
// reader's own pick survives their refresh. Same browser, two readings — hence two keys, not a flag.
const PREVIEW_STORAGE_KEY = 'kosztorys-preview:summary-view'
const VALID_VIEWS: readonly SummaryViewT[] = [
  'summary',
  'expenses',
  'stages',
  'subcontractors',
  'margin',
]
const SUMMARY_VIEW_DEFAULT: SummaryViewT = 'summary'

export function useSummaryView(preview = false): [SummaryViewT, (view: SummaryViewT) => void] {
  return usePersistedEnum(
    preview ? PREVIEW_STORAGE_KEY : STORAGE_KEY,
    VALID_VIEWS,
    SUMMARY_VIEW_DEFAULT,
  )
}
