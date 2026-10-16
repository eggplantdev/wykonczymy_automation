import { describe, it, expect } from 'vitest'
import { getTransferColumns } from '@/components/tables/transfers'
import { SERVER_SORTABLE_TRANSFER_COLUMNS } from '@/lib/transfers/sortable-columns'

describe('the server sort whitelist', () => {
  const declaredIds = getTransferColumns().map((column) => column.id!)

  it.each(SERVER_SORTABLE_TRANSFER_COLUMNS)('"%s" is a column the table renders', (columnId) => {
    expect(declaredIds).toContain(columnId)
  })
})
