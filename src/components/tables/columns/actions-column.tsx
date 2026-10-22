import type { ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'

export function actionsColumn<TData>(
  renderActions: (row: TData) => ReactNode,
  header: string = 'Akcje',
) {
  return createColumnHelper<TData>().display({
    id: 'actions',
    header,
    cell: (info) => {
      const actions = renderActions(info.row.original)
      return actions && <div className="flex items-center gap-1">{actions}</div>
    },
  })
}
