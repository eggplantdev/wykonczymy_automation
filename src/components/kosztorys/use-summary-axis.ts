'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'
import { SUMMARY_AXIS_DEFAULT, type MoneyAxisT } from '@/lib/kosztorys/money-axis'

// The totals panel's own axis pick. Extends MoneyAxisT with a panel-only 'cash' value: 'both' keeps
// its original meaning (netto + brutto columns side by side), 'cash' is the „Mieszane"
// cash-settlement view (netto-only figures + the gotówka block).
export type PanelAxisT = MoneyAxisT | 'cash'

// Persisted globally in localStorage — a reading preference of the person, not of one kosztorys;
// same `table-columns:` family as the grid's money-axis picker, so clearing that memory clears this
// too. Survives refresh and the editor's restore-remount, which the previous useState did not.
const STORAGE_KEY = 'table-columns:kosztorys-summary-axis'
const VALID_AXES: readonly PanelAxisT[] = ['net', 'gross', 'both', 'cash']

export function useSummaryAxis(): [PanelAxisT, (axis: PanelAxisT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_AXES, SUMMARY_AXIS_DEFAULT)
}
