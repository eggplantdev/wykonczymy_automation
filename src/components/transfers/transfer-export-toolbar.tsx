'use client'

import { useCallback, useState } from 'react'
import type { VisibilityState } from '@tanstack/react-table'
import { Printer, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildTransferCsv } from '@/lib/export/csv'
import { triggerDownload } from '@/lib/export/download'
import { getTransferColumns } from '@/lib/tables/transfers'
import type { ExportContextT } from '@/types/export'

type TransferExportToolbarPropsT = {
  readonly serializedWhere: string
  readonly columnVisibility: VisibilityState
  readonly excludeColumns: string[]
  readonly context: ExportContextT
  readonly contextId: number
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
  serializedWhere,
  columnVisibility,
  excludeColumns,
  context,
  contextId,
}: TransferExportToolbarPropsT) {
  const [isCsvLoading, setIsCsvLoading] = useState(false)

  const visibleColumnIds = getVisibleColumnIds(excludeColumns, columnVisibility)

  const handlePrint = useCallback(() => {
    const whereBase64 = btoa(serializedWhere)
    const columns = visibleColumnIds.join(',')
    const url = `/drukuj/transfery?context=${context}&contextId=${contextId}&where=${encodeURIComponent(whereBase64)}&columns=${columns}`
    window.open(url, '_blank')
  }, [serializedWhere, visibleColumnIds, context, contextId])

  const handleCsv = useCallback(async () => {
    setIsCsvLoading(true)
    try {
      const result = await fetchFilteredTransfers(serializedWhere)
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
  }, [serializedWhere, visibleColumnIds])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handlePrint}
        aria-label="Drukuj transfery"
      >
        <Printer className="size-4" />
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
