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

export function TransferDataTable({ data, paginationMeta, config }: TransferDataTablePropsT) {
  const { baseUrl, excludeColumns = [], filters, context, contextId } = config
  const columns = getTransferColumns(excludeColumns)

  return (
    <div className={cn('mt-4 space-y-4')}>
      {filters && <TransferFilters {...filters} baseUrl={baseUrl} />}
      <DataTable
        data={data}
        columns={columns}
        storageKey="transfers"
        toolbar={(table, cv) => (
          <div className="ml-auto flex items-center gap-2">
            {context && contextId && (
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
