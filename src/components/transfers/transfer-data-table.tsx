'use client'

import { useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/tables/data-table/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination/pagination-footer'
import { TransferFilters } from '@/components/transfers/transfer-filters'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InvoiceDownloadDialog } from '@/components/transfers/invoice-download-dialog'
import { PrintTransfersButton } from '@/components/transfers/print-transfers-button'
import { DuplicateFinderDialog } from '@/components/transfers/duplicate-finder-dialog'
import { getTransferColumns, transferRowClassName } from '@/components/tables/transfers'
import type { TransferRowT } from '@/types/transfers'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import type {
  TransferRowsFetchT,
  TransferTableConfigT,
} from '@/components/transfers/transfer-table-config'
import { fetchFilteredTransfers } from '@/lib/queries/fetch-transfers-for-invoices'
import { findExpenseDuplicateGroups } from '@/lib/queries/expense-duplicate-groups'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import { sortParamToSortingState, sortingStateToParam } from '@/lib/table/sort-param'
import { validTransferSort } from '@/lib/queries/transfer-sort'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import { useTranslation } from '@/hooks/use-translation'
import { TransferCardList } from '@/components/transfers/cards/transfer-card-list'
import { TransferViewSwitch } from '@/components/transfers/cards/transfer-view-switch'
import { TRANSFER_VIEWS, TRANSFER_VIEW_STORAGE_KEY } from '@/lib/constants/transfer-view'
import { usePersistedEnum } from '@/hooks/use-persisted-value'

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
  const translator = useTranslation('transfers')
  const {
    title,
    baseUrl,
    excludeColumns = [],
    filters,
    totalFilteredAmount,
    listsCancelled,
    invoiceDownload,
    print,
    duplicateFinder,
    uncoloredAmounts,
  } = config

  const fetchRows: TransferRowsFetchT = (opts) => fetchFilteredTransfers(config.query.where, opts)

  // The same whitelist the server used, so a hand-edited `?sort=` the page refused cannot leave the
  // header arrow — or the printout, which reads this state — pointing somewhere else.
  const { updateParam } = useUrlFilterParams(baseUrl)
  const sorting = sortParamToSortingState(validTransferSort(searchParams.get('sort') ?? undefined))

  const [view, setView] = usePersistedEnum(TRANSFER_VIEW_STORAGE_KEY, TRANSFER_VIEWS, 'table')

  const columns = getTransferColumns(excludeColumns, {
    referenceData,
    currentUserId,
    currentUserRole,
    translator,
    uncoloredAmounts,
  })

  return (
    <div>
      {filters && (
        <CollapsibleSection
          className="w-fit"
          title={translator.t('filtersTitle')}
          size="sm"
          defaultOpen={false}
          storageKey="transfers:filters"
        >
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
        getRowClassName={transferRowClassName}
        renderRows={
          view === 'list'
            ? (rows, visibleColumnIds) => (
                <TransferCardList
                  rows={rows}
                  visibleColumnIds={visibleColumnIds}
                  uncoloredAmounts={uncoloredAmounts}
                />
              )
            : undefined
        }
        toolbar={({ table, columnVisibility: cv, ...order }) => (
          <DataTableToolbar
            className="mt-8"
            title={title}
            columns={<ColumnToggle table={table} columnVisibility={cv} {...order} />}
            actions={
              <>
                <TransferViewSwitch view={view} onChange={setView} className="max-sm:col-span-2" />
                {invoiceDownload && <InvoiceDownloadDialog fetchRows={fetchRows} />}
                {duplicateFinder && (
                  <DuplicateFinderDialog
                    findGroups={(range) => findExpenseDuplicateGroups(config.query.where, range)}
                  />
                )}
                {print && (
                  <PrintTransfersButton
                    fetchRows={fetchRows}
                    table={table}
                    title={translator.t('title')}
                  />
                )}
              </>
            }
          />
        )}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={baseUrl} />
    </div>
  )
}
