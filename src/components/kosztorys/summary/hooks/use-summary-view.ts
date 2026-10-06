'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'
import {
  ALL_SUMMARY_VIEWS,
  type SummaryViewT,
} from '@/components/kosztorys/summary/model/summary-views'

// Persisted globally in localStorage — a reading position of the person, not of one kosztorys, same
// `table-columns:` family as the panel's axis pick. Survives refresh and the editor restore-remount.
const STORAGE_KEY = 'table-columns:kosztorys-summary-view'
// The client document keeps its own key, outside the `table-columns:` family EX-591 keeps out of the
// client's grid: the owner's last tab still cannot decide which panel that document opens on, while a
// reader's own pick survives their refresh. Same browser, two readings — hence two keys, not a flag.
const PREVIEW_STORAGE_KEY = 'kosztorys-preview:summary-view'
const SUMMARY_VIEW_DEFAULT: SummaryViewT = 'summary'

// Which view the totals panel shows — the top toggle drives it directly, fully independent of the
// grid's price view.
export function useSummaryView(preview = false): [SummaryViewT, (view: SummaryViewT) => void] {
  return usePersistedEnum(
    preview ? PREVIEW_STORAGE_KEY : STORAGE_KEY,
    ALL_SUMMARY_VIEWS,
    SUMMARY_VIEW_DEFAULT,
  )
}
