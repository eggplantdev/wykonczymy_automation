import { describe, it, expect } from 'vitest'
import { getTransferColumns } from '@/components/tables/transfers'
import { SERVER_SORTABLE_TRANSFER_COLUMNS } from '@/lib/transfers/sortable-columns'

// Sortability is derived from the whitelist, so „every sortable column is server-sortable" is true
// by construction and needs no spec. The reverse is not: a whitelist entry naming a column the
// table never renders is an ordering nobody can ask for, and nothing else fails on it. Predecessor
// of this spec pinned „column id hits a real row key"; server-side sorting makes the stronger
// claim — „column id hits a real database column".
describe('the server sort whitelist', () => {
  const declaredIds = getTransferColumns().map((column) => column.id!)

  it.each(SERVER_SORTABLE_TRANSFER_COLUMNS)('"%s" is a column the table renders', (columnId) => {
    expect(declaredIds).toContain(columnId)
  })
})
