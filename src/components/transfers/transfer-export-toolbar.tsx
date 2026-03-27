'use client'

import type { SortingState, VisibilityState } from '@tanstack/react-table'
import { getTransferColumns } from '@/lib/tables/transfers'
import { PrintButton } from '@/components/transfers/print-button'
import { CsvButton } from '@/components/transfers/csv-button'
import { InvoiceDownloadButton } from '@/components/transfers/invoice-download-button'
import type { TransferTableConfigT } from '@/types/export'

type TransferExportToolbarPropsT = {
  config: TransferTableConfigT
  columnVisibility: VisibilityState
  sorting: SortingState
}

function getVisibleColumnIds(
  excludeColumns: string[],
  columnVisibility: VisibilityState,
): string[] {
  const columns = getTransferColumns(excludeColumns)
  return columns
    .filter((col) => col.id && columnVisibility[col.id] !== false)
    .map((col) => col.id as string)
}

export function TransferExportToolbar({
  config,
  columnVisibility,
  sorting,
}: TransferExportToolbarPropsT) {
  const { excludeColumns = [] } = config
  const visibleColumnIds = getVisibleColumnIds(excludeColumns, columnVisibility)

  return (
    <>
      <PrintButton config={config} visibleColumnIds={visibleColumnIds} sorting={sorting} />
      <CsvButton where={config.query.where} visibleColumnIds={visibleColumnIds} sorting={sorting} />
      <InvoiceDownloadButton where={config.query.where} />
    </>
  )
}
