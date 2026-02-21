'use client'

import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { TransferFilters } from '@/components/transfers/transfer-filters'
import { getTransferColumns, type TransferRowT } from '@/lib/tables/transfers'
import type { PaginationMetaT } from '@/lib/pagination'
import { cn } from '../../lib/cn'
import type { FilterConfigT } from '@/types/filters'

type TransferDataTablePropsT = {
  readonly data: readonly TransferRowT[]
  readonly paginationMeta: PaginationMetaT
  readonly excludeColumns?: string[]
  readonly baseUrl: string
  readonly filters?: FilterConfigT
  readonly className?: string
}

export function TransferDataTable({
  data,
  paginationMeta,
  excludeColumns = [],
  baseUrl,
  filters,
  className,
}: TransferDataTablePropsT) {
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
        toolbar={(table) => <ColumnToggle table={table} />}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={baseUrl} />
    </div>
  )
}
