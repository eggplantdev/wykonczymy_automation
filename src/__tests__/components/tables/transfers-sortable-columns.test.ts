import { describe, it, expect } from 'vitest'
import { getTransferColumns } from '@/components/tables/transfers'
import { sortKeyForColumn } from '@/lib/transfers/sort-transfer-rows'
import { transferRow } from '@/__tests__/fixtures/transfer-row'

// A missing alias fails silently: the accessor reads undefined on every row, the comparator returns
// 0, and the printout quietly comes out in fetch order while the screen is sorted. That is exactly
// how sorting by „Pracownik" was lost — so pin the whole set, not the one id that went missing.
describe('every sortable transfer column resolves to a real row key', () => {
  const sortableIds = getTransferColumns()
    .filter((column) => column.enableSorting !== false)
    .map((column) => column.id!)

  it('has sortable columns to check', () => {
    expect(sortableIds.length).toBeGreaterThan(0)
  })

  it.each(sortableIds)('"%s"', (columnId) => {
    expect(Object.keys(transferRow())).toContain(sortKeyForColumn(columnId))
  })
})
