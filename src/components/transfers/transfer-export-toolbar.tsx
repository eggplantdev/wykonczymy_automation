'use client'

import { useCallback, useState } from 'react'
import type { VisibilityState } from '@tanstack/react-table'
import { Printer, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildTransferCsv } from '@/lib/export/csv'
import { triggerDownload } from '@/lib/export/download'
import { buildPrintHtml } from '@/lib/export/print'
import { printViaIframe } from '@/lib/export/print-iframe'
import { getTransferColumns } from '@/lib/tables/transfers'
import type { TransferTableConfigT } from '@/types/export'

type TransferExportToolbarPropsT = {
  readonly config: TransferTableConfigT
  readonly columnVisibility: VisibilityState
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
  const { query, excludeColumns = [], headerFields = [] } = config
  const [isPrintLoading, setIsPrintLoading] = useState(false)
  const [isCsvLoading, setIsCsvLoading] = useState(false)

  const visibleColumnIds = getVisibleColumnIds(excludeColumns, columnVisibility)

  const handlePrint = useCallback(async () => {
    setIsPrintLoading(true)
    try {
      const result = await fetchFilteredTransfers(query.where)
      if (!result.success) {
        console.error('Print fetch failed:', result.error)
        return
      }
      const html = buildPrintHtml(result.data, visibleColumnIds, headerFields)
      printViaIframe(html)
    } finally {
      setIsPrintLoading(false)
    }
  }, [query.where, visibleColumnIds, headerFields])

  const handleCsv = useCallback(async () => {
    setIsCsvLoading(true)
    try {
      const result = await fetchFilteredTransfers(query.where)
      if (!result.success) {
        console.error('Export failed:', result.error)
        return
      }
      const csv = buildTransferCsv(result.data, visibleColumnIds)
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const date = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `transfery-${date}.csv`)
    } finally {
      setIsCsvLoading(false)
    }
  }, [query.where, visibleColumnIds])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handlePrint}
        disabled={isPrintLoading}
        aria-label="Drukuj transfery"
      >
        {isPrintLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Printer className="size-4" />
        )}
        Drukuj
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleCsv}
        disabled={isCsvLoading}
        aria-label="Pobierz CSV"
      >
        {isCsvLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        CSV
      </Button>
    </>
  )
}
