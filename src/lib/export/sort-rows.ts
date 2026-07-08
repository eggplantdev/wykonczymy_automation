import type { SortingState } from '@tanstack/react-table'
import type { TransferRowT } from '@/components/tables/transfers'

/**
 * Maps table column IDs to TransferRowT accessor keys.
 * Only entries where column id differs from the accessor key.
 */
const COLUMN_TO_ACCESSOR: Record<string, keyof TransferRowT> = {
  investment: 'investmentName',
  expenseCategory: 'expenseCategoryName',
  otherCategory: 'otherCategoryName',
  sourceRegister: 'sourceRegisterName',
  targetRegister: 'targetRegisterName',
  createdBy: 'createdByName',
  invoice: 'invoiceUrl',
}

/** Sorts transfer rows to match the table's current SortingState. */
export function sortTransferRows(rows: TransferRowT[], sorting: SortingState): TransferRowT[] {
  if (sorting.length === 0) return rows
  const sorted = [...rows]
  sorted.sort((a, b) => {
    for (const { id, desc } of sorting) {
      const key = COLUMN_TO_ACCESSOR[id] ?? (id as keyof TransferRowT)
      const aVal = a[key]
      const bVal = b[key]

      let cmp = 0
      if (aVal == null && bVal == null) cmp = 0
      else if (aVal == null) cmp = -1
      else if (bVal == null) cmp = 1
      else if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal
      else cmp = String(aVal).localeCompare(String(bVal), 'pl')

      if (cmp !== 0) return desc ? -cmp : cmp
    }
    return 0
  })

  return sorted
}
