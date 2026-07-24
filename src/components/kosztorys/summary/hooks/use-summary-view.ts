'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Which client-plane view the totals panel shows: the „Podsumowanie" summary block, the „Wydatki"
// transaction list, or the „Wpłaty" deposit list. Independent of the grid's price view — the top
// toggle drives it directly (disabled on the subcontractor plane, which has its own summary).
export type SummaryViewT = 'summary' | 'wydatki' | 'wplaty' | 'etapy'

// Persisted globally in localStorage — a reading position of the person, not of one kosztorys, same
// `table-columns:` family as the panel's axis pick. Survives refresh and the editor restore-remount.
const STORAGE_KEY = 'table-columns:kosztorys-summary-view'
const VALID_VIEWS: readonly SummaryViewT[] = ['summary', 'wydatki', 'wplaty', 'etapy']
const SUMMARY_VIEW_DEFAULT: SummaryViewT = 'summary'

export function useSummaryView(): [SummaryViewT, (view: SummaryViewT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_VIEWS, SUMMARY_VIEW_DEFAULT)
}
