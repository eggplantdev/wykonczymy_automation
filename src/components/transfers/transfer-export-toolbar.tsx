'use client'

import type { VisibilityState } from '@tanstack/react-table'
import { getTransferColumns } from '@/lib/tables/transfers'
import { PrintButton } from '@/components/transfers/print-button'
import { CsvButton } from '@/components/transfers/csv-button'
import type { TransferTableConfigT } from '@/types/export'

type TransferExportToolbarPropsT = {
  config: TransferTableConfigT
  columnVisibility: VisibilityState
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

export function TransferExportToolbar({ config, columnVisibility }: TransferExportToolbarPropsT) {
  const { excludeColumns = [] } = config
  const visibleColumnIds = getVisibleColumnIds(excludeColumns, columnVisibility)

  return (
    <>
      <PrintButton config={config} visibleColumnIds={visibleColumnIds} />
      <CsvButton where={config.query.where} visibleColumnIds={visibleColumnIds} />
    </>
  )
}
