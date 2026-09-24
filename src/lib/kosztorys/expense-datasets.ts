import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { MaterialTransactionRowT } from '@/types/transfers'

export type ExpenseDatasetT = 'gross' | 'net' | 'settled'

export type ExpensePartitionT = Record<ExpenseDatasetT, MaterialTransactionRowT[]>

// Korekty ride with the brutto expenses: the Sheet files them there (CORRECTION_MOVED_LABEL) and
// they count into `totalMaterialCosts`, so the brutto tab's Σ is the breakdown's brutto figure only
// with them included.
//
// The netto test comes BEFORE `settled` to mirror `materialsNetBilled`, which ignores `settled`
// (see the bucketing matrix): the netto type is `settleable: false`, so a settled netto row cannot
// be written — but were one forged, the model still bills it, and routing it to the settled tab
// would hide it from the two totals that must add up to `totalMaterialCosts`.
export function partitionExpenseRows(rows: MaterialTransactionRowT[]): ExpensePartitionT {
  const partition: ExpensePartitionT = { gross: [], net: [], settled: [] }

  for (const row of rows) {
    if (row.type === 'INVESTMENT_EXPENSE_NET') partition.net.push(row)
    else if (row.settled) partition.settled.push(row)
    else partition.gross.push(row)
  }

  return partition
}

// The two expense sets first, in the order their „Razem" figures add to the breakdown's total; the
// set that never bills the investor comes last. A `Record` rather than a tuple so a new dataset
// cannot compile until it has been given a place in the strip.
const DATASET_RANK: Record<ExpenseDatasetT, number> = { gross: 0, net: 1, settled: 2 }

const DATASET_ORDER = (Object.keys(DATASET_RANK) as ExpenseDatasetT[]).sort(
  (a, b) => DATASET_RANK[a] - DATASET_RANK[b],
)

// An empty set gets no tab at all — an investment with no netto and no settled materials is the
// common case, and a tab that shows „brak danych" is just a dead end.
export function availableExpenseDatasets(partition: ExpensePartitionT): ExpenseDatasetT[] {
  return DATASET_ORDER.filter((set) => partition[set].length > 0)
}

// Σ over the two expense sets is `totalMaterialCosts`, which is what makes the split checkable
// against the breakdown above the list.
export function sumBilled(rows: MaterialTransactionRowT[]): number {
  return rows.reduce((acc, row) => acc + row.billed, 0)
}

// What left the kasa — the investor's list total, which is never reconciled against the billed
// figure: it sits at or above it, in the investor's favour (owner, 2026-09-23).
export function sumAmount(rows: MaterialTransactionRowT[]): number {
  return rows.reduce((acc, row) => acc + row.amount, 0)
}

// A row served from a stale cache has no type yet; link to the unfiltered list rather than to a
// filter that would exclude the row it points at.
export function expenseRowHref(investmentId: number, row: MaterialTransactionRowT): string {
  return investmentTransfersHref(investmentId, {
    types: row.type ? [row.type] : undefined,
    id: row.id,
  })
}

// What a client may see of the list. The settled bucket is the company's own spend — the breakdown
// block above the list is already withheld from a preview, so leaving these rows here would hand
// back, item by item (with faktury), exactly the figure that block withholds. Routed through the
// partition rather than re-testing `row.settled`, so „settled" means one thing in both places.
export function clientVisibleExpenseRows(
  rows: MaterialTransactionRowT[],
): MaterialTransactionRowT[] {
  const settled = new Set(partitionExpenseRows(rows).settled)
  return rows.filter((row) => !settled.has(row))
}
