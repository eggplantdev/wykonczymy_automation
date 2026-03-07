'use client'

import { useState } from 'react'
import type { VisibilityState } from '@tanstack/react-table'
import { Printer, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildTransferCsv } from '@/lib/export/csv'
import { triggerDownload } from '@/lib/export/download'
import { buildPrintHtml } from '@/lib/export/print'
import { printViaIframe } from '@/lib/export/print-iframe'
import { getTransferColumns } from '@/lib/tables/transfers'
import { formatPLN } from '@/lib/format-currency'
import { BILANS_LABEL, calculateBilans } from '@/lib/export/header-fields'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
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

  const storeVisibility = useHeaderFieldsStore((s) => s.visibility)

  const visibleColumnIds = getVisibleColumnIds(excludeColumns, columnVisibility)

  // If store has visibility state (investment page), apply it; otherwise pass through all fields
  const hasStoreVisibility = Object.keys(storeVisibility).length > 0
  const visibleHeaderFields = hasStoreVisibility
    ? headerFields
        .filter((f) => storeVisibility[f.label] !== false)
        .map((f) => {
          if (f.label !== BILANS_LABEL) return f
          const bilans = calculateBilans(headerFields, storeVisibility)
          return { ...f, value: formatPLN(bilans) }
        })
    : [...headerFields]

  async function handlePrint() {
    setIsPrintLoading(true)
    try {
      const result = await fetchFilteredTransfers(query.where)
      if (!result.success) {
        console.error('Print fetch failed:', result.error)
        return
      }
      const title =
        visibleHeaderFields.find((f) => f.label === 'Inwestycja' || f.label === 'Kasa')?.value ??
        'Transfery'
      const html = buildPrintHtml(result.data, visibleColumnIds, visibleHeaderFields, title)
      printViaIframe(html)
    } finally {
      setIsPrintLoading(false)
    }
  }

  async function handleCsv() {
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
  }

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
