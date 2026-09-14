import type { SortingState } from '@tanstack/react-table'
import type { TransferRowT } from '@/types/transfers'

/** Only the columns whose id differs from the row key they read. */
const COLUMN_TO_ACCESSOR: Record<string, keyof TransferRowT> = {
  investment: 'investmentName',
  expenseCategory: 'expenseCategoryName',
  otherCategory: 'otherCategoryName',
  sourceRegister: 'sourceRegisterName',
  targetRegister: 'targetRegisterName',
  createdBy: 'createdByName',
  worker: 'workerName',
}

/**
 * Replays the table's SortingState on a refetched set — the fetch always returns `-date`, while the
 * screen may be sorted on anything. Collation is Polish, which the screen's TanStack comparator is
 * not, so the two can disagree on diacritics; on paper the Polish order is the one that reads right.
 */
/** Exported so a spec can assert every sortable column id lands on a key a row actually has. */
export function sortKeyForColumn(columnId: string): keyof TransferRowT {
  return COLUMN_TO_ACCESSOR[columnId] ?? (columnId as keyof TransferRowT)
}

export function sortTransferRows(rows: TransferRowT[], sorting: SortingState): TransferRowT[] {
  if (sorting.length === 0) return rows

  const sorted = [...rows]
  sorted.sort((left, right) => {
    for (const { id, desc } of sorting) {
      const key = sortKeyForColumn(id)
      const leftValue = left[key]
      const rightValue = right[key]

      let comparison = 0
      if (leftValue == null && rightValue == null) comparison = 0
      else if (leftValue == null) comparison = -1
      else if (rightValue == null) comparison = 1
      else if (typeof leftValue === 'number' && typeof rightValue === 'number')
        comparison = leftValue - rightValue
      else comparison = String(leftValue).localeCompare(String(rightValue), 'pl')

      if (comparison !== 0) return desc ? -comparison : comparison
    }
    return 0
  })

  return sorted
}
