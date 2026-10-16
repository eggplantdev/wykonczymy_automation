import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { MaterialTransactionRowT } from '@/types/transfers'

export type ExpenseDatasetT = 'gross' | 'net' | 'settled'

export type ExpensePartitionT = Record<ExpenseDatasetT, MaterialTransactionRowT[]>

// The netto test comes BEFORE `settled` to mirror `materialsNetBilled`, which ignores `settled`.
export function partitionExpenseRows(rows: MaterialTransactionRowT[]): ExpensePartitionT {
  const partition: ExpensePartitionT = { gross: [], net: [], settled: [] }

  for (const row of rows) {
    if (row.type === 'INVESTMENT_EXPENSE_NET') partition.net.push(row)
    else if (row.settled) partition.settled.push(row)
    else partition.gross.push(row)
  }

  return partition
}

// A `Record` rather than a tuple so a new dataset
// cannot compile until it has been given a place in the strip.
const DATASET_RANK: Record<ExpenseDatasetT, number> = { gross: 0, net: 1, settled: 2 }

const DATASET_ORDER = (Object.keys(DATASET_RANK) as ExpenseDatasetT[]).sort(
  (a, b) => DATASET_RANK[a] - DATASET_RANK[b],
)

export function availableExpenseDatasets(partition: ExpensePartitionT): ExpenseDatasetT[] {
  return DATASET_ORDER.filter((set) => partition[set].length > 0)
}

export function sumBilled(rows: MaterialTransactionRowT[]): number {
  return rows.reduce((acc, row) => acc + row.billed, 0)
}

export function sumAmount(rows: MaterialTransactionRowT[]): number {
  return rows.reduce((acc, row) => acc + row.amount, 0)
}

export function expenseRowHref(investmentId: number, row: MaterialTransactionRowT): string {
  return investmentTransfersHref(investmentId, {
    types: [row.type],
    id: row.id,
  })
}

// The settled bucket is the company's own spend — the breakdown
// block above the list is already withheld from a preview, so leaving these rows here would hand
// back, item by item (with faktury), exactly the figure that block withholds.
export function clientVisibleExpenseRows(
  rows: MaterialTransactionRowT[],
): MaterialTransactionRowT[] {
  const settled = new Set(partitionExpenseRows(rows).settled)
  return rows.filter((row) => !settled.has(row))
}
