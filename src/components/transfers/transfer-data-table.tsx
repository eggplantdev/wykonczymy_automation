'use client'

import { useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { CancelledFilterButton } from '@/components/transfers/cancelled-filter-button'
import { CancelledTransactionAuditButton } from '@/components/transfers/cancelled-transaction-audit-button'
import { TransferFilters } from '@/components/transfers/transfer-filters'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InvoiceDownloadButton } from '@/components/transfers/invoice-download-button'
import { PrintTransfersButton } from '@/components/transfers/print-transfers-button'
import { getTransferColumns } from '@/components/tables/transfers'
import type { TransferRowT } from '@/types/transfers'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import type { TransferTableConfigT } from '@/components/transfers/transfer-table-config'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import { sortParamToSortingState, sortingStateToParam } from '@/lib/table/sort-param'
import { validTransferSort } from '@/lib/queries/transfer-sort'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'

type TransferDataTablePropsT = {
  data: TransferRowT[]
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
  const searchParams = useSearchParams()
  const {
    title,
    baseUrl,
    excludeColumns = [],
    filters,
    totalFilteredAmount,
    listsCancelled,
    invoiceDownload,
    print,
  } = config

  // Through the same whitelist the server used, so a hand-edited `?sort=` the page refused cannot
  // leave the header arrow — or the printout, which reads this state — pointing somewhere else.
  const { updateParam } = useUrlFilterParams(baseUrl)
  const sorting = sortParamToSortingState(validTransferSort(searchParams.get('sort') ?? undefined))

  const columns = getTransferColumns(excludeColumns, {
    referenceData,
    currentUserId,
    currentUserRole,
  })

  return (
    <div className="">
      {filters && (
        <CollapsibleSection className={`w-fit`} title="Filtry" size="sm">
          <TransferFilters
            {...filters}
            baseUrl={baseUrl}
            totalFilteredAmount={totalFilteredAmount}
            listsCancelled={listsCancelled}
            className="pt-3"
          />
        </CollapsibleSection>
      )}
      <DataTable
        data={data}
        columns={columns}
        storageKey="transfers"
        sorting={sorting}
        onSortingChange={(next) => updateParam('sort', sortingStateToParam(next))}
        getRowClassName={(row) => {
          if (row.cancelled) return '[&_td]:line-through [&_td]:text-muted-foreground'
          if (row.type === 'CANCELLATION') return '[&_td]:text-muted-foreground'
          return ''
        }}
        toolbar={({ table, columnVisibility: cv, ...order }) => (
          <div className={`mt-8 flex w-full flex-wrap items-center justify-between gap-4`}>
            {title && <h2 className="text-foreground w-full text-lg font-semibold">{title}</h2>}
            <div className="flex items-center gap-2">
              <CancelledTransactionAuditButton baseUrl={baseUrl} />
              <CancelledFilterButton baseUrl={baseUrl} />
              {invoiceDownload && <InvoiceDownloadButton where={config.query.where} />}
              {print && (
                <PrintTransfersButton where={config.query.where} table={table} title="Transakcje" />
              )}
              <ColumnToggle table={table} columnVisibility={cv} {...order} />
            </div>
          </div>
        )}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={baseUrl} />
    </div>
  )
}
