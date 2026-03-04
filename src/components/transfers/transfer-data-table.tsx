'use client'

import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { TransferFilters } from '@/components/transfers/transfer-filters'
import { TransferExportToolbar } from '@/components/transfers/transfer-export-toolbar'
import { getTransferColumns, type TransferRowT } from '@/lib/tables/transfers'
import type { PaginationMetaT } from '@/lib/pagination'
import { cn } from '../../lib/cn'
import type { TransferTableConfigT } from '@/types/export'

type TransferDataTablePropsT = {
  readonly data: readonly TransferRowT[]
  readonly paginationMeta: PaginationMetaT
  readonly config: TransferTableConfigT
  readonly className?: string
}

export function TransferDataTable({
  data,
  paginationMeta,
  config,
  className,
}: TransferDataTablePropsT) {
  const { query, baseUrl, excludeColumns = [], filters, context, contextId } = config
  const columns = getTransferColumns(excludeColumns)

  return (
    <div className={cn('space-y-4', className)}>
      {filters && (
        <TransferFilters
          cashRegisters={filters.cashRegisters}
          investments={filters.investments}
          users={filters.users}
          showTypeFilter={filters.showTypeFilter}
          baseUrl={baseUrl}
        />
      )}
      <DataTable
        data={data}
        columns={columns}
        emptyMessage="Brak transferów"
        storageKey="transfers"
        toolbar={(table, cv) => (
          <>
            {context && contextId && (
              <TransferExportToolbar
                where={query.where}
                columnVisibility={cv}
                excludeColumns={excludeColumns}
                context={context}
                contextId={contextId}
              />
            )}
            <ColumnToggle table={table} columnVisibility={cv} />
          </>
        )}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={baseUrl} />
    </div>
  )
}
