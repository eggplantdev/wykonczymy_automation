import { describe, it, expect } from 'vitest'
import { getTransferColumns } from '@/components/tables/transfers'
import { SERVER_SORTABLE_TRANSFER_COLUMNS } from '@/lib/transfers/sortable-columns'

// Sortability is derived from the whitelist, so „every sortable column is server-sortable" holds
// by construction. The reverse doesn't: a whitelist entry naming a column the table never renders
// is an unreachable order that nothing else catches.
describe('the server sort whitelist', () => {
  const declaredIds = getTransferColumns().map((column) => column.id!)

  it.each(SERVER_SORTABLE_TRANSFER_COLUMNS)('"%s" is a column the table renders', (columnId) => {
    expect(declaredIds).toContain(columnId)
  })
})
