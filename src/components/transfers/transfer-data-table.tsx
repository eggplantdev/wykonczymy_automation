'use client'

import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { TransferFilters } from '@/components/transfers/transfer-filters'
import { TransferExportToolbar } from '@/components/transfers/transfer-export-toolbar'
import { getTransferColumns, type TransferRowT } from '@/lib/tables/transfers'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { PaginationMetaT } from '@/lib/pagination'
import type { TransferTableConfigT } from '@/types/export'
import type { ReferenceDataBaseT } from '@/types/reference-data'

type TransferDataTablePropsT = {
  data: readonly TransferRowT[]
  paginationMeta: PaginationMetaT
  config: TransferTableConfigT
  referenceData?: ReferenceDataBaseT
}

export function TransferDataTable({
  data,
  paginationMeta,
  config,
  referenceData,
}: TransferDataTablePropsT) {
  const { id: currentUserId, role: currentUserRole } = useCurrentUser()
  const { baseUrl, excludeColumns = [], filters, headerFields } = config
  const columns = getTransferColumns(excludeColumns, {
    referenceData,
    currentUserId,
    currentUserRole,
  })

  return (
    <div className="mt-4 space-y-4">
      {filters && <TransferFilters {...filters} baseUrl={baseUrl} />}
      <DataTable
        data={data}
        columns={columns}
        storageKey="transfers"
        getRowClassName={(row) => {
          if (row.cancelled) return '[&_td]:line-through [&_td]:text-muted-foreground'
          if (row.type === 'CANCELLATION') return '[&_td]:text-muted-foreground'
          return ''
        }}
        toolbar={(table, cv) => (
          <div className="ml-auto flex items-center gap-2">
            {headerFields && headerFields.length > 0 && (
              <TransferExportToolbar config={config} columnVisibility={cv} />
            )}
            <ColumnToggle table={table} columnVisibility={cv} />
          </div>
        )}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={baseUrl} />
    </div>
  )
}
