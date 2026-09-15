import { describe, it, expect } from 'vitest'
import { getTransferColumns } from '@/components/tables/transfers'
import { SERVER_SORTABLE_TRANSFER_COLUMNS } from '@/lib/transfers/sortable-columns'

// The two lists answer the same question from opposite ends and neither fails loudly on its own: a
// column left sortable that the whitelist rejects gets a clickable header whose click is thrown
// away by the parser, and a whitelist entry with no sortable column is an ordering nobody can ask
// for. Predecessor of this spec pinned „column id hits a real row key"; server-side sorting makes
// the stronger claim — „column id hits a real database column" — so it replaces it.
describe('sortable transfer columns match the server whitelist', () => {
  const sortableIds = getTransferColumns()
    .filter((column) => column.enableSorting !== false)
    .map((column) => column.id!)

  const declaredIds = getTransferColumns().map((column) => column.id!)

  it('every sortable column is server-sortable', () => {
    expect([...sortableIds].sort()).toEqual([...SERVER_SORTABLE_TRANSFER_COLUMNS].sort())
  })

  it.each(SERVER_SORTABLE_TRANSFER_COLUMNS)('"%s" is a real column', (columnId) => {
    expect(declaredIds).toContain(columnId)
  })
})
