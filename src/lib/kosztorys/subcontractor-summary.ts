import type { SubcontractorPayoutRowT } from '@/types/reference-data'

export type SubcontractorSummaryT = {
  // „Suma wykonanej pracy" (należne) — executed value at the active view's subcontractor price, pre-rabat.
  dueNet: number
  // Σ realized PAYOUTs on this investment (all workers incl. the null bucket).
  payoutsTotal: number
  // „Pozostało do wypłaty" = dueNet − payoutsTotal. Negative = the crew has been overpaid.
  remaining: number
  // Per-worker rows, sorted by amount desc with the null-worker bucket („Bez przypisanego pracownika")
  // pinned last regardless of its total, so an unattributed lump never leads the list.
  rows: SubcontractorPayoutRowT[]
}

/**
 * Pure block figures for „Podsumowanie podwykonawców". Whole-investment amounts (both `dueNet` and
 * `payoutsTotal` are investment-level), so `remaining` is the total still owed to the whole crew — it
 * deliberately does not attribute work to individual workers (no work↔worker link exists).
 */
export function computeSubcontractorSummary(
  dueNet: number,
  payouts: SubcontractorPayoutRowT[],
): SubcontractorSummaryT {
  const payoutsTotal = payouts.reduce((sum, row) => sum + row.total, 0)
  const rows = [...payouts].sort((a, b) => {
    // Null-worker bucket last, no matter its amount.
    if (a.workerId === null) return 1
    if (b.workerId === null) return -1
    return b.total - a.total
  })
  return { dueNet, payoutsTotal, remaining: dueNet - payoutsTotal, rows }
}
