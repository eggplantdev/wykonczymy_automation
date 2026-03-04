'use client'

import { useState } from 'react'
import type { VisibilityState } from '@tanstack/react-table'
import { Printer, Download, Loader2, CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildTransferCsv } from '@/lib/export/csv'
import { triggerDownload } from '@/lib/export/download'
import { buildPrintHtml } from '@/lib/export/print'
import { printViaIframe } from '@/lib/export/print-iframe'
import { getTransferColumns } from '@/lib/tables/transfers'
import { cn } from '@/lib/cn'
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
  const [headerFieldVisibility, setHeaderFieldVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(headerFields.map((f) => [f.label, true])),
  )

  const visibleColumnIds = getVisibleColumnIds(excludeColumns, columnVisibility)
  const visibleHeaderFields = headerFields.filter((f) => headerFieldVisibility[f.label] !== false)

  function toggleHeaderField(label: string) {
    setHeaderFieldVisibility((prev) => ({ ...prev, [label]: !prev[label] }))
  }

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {headerFields.length > 0 && (
            <>
              <DropdownMenuLabel>Pola nagłówka</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {headerFields.map((field) => (
                <DropdownMenuItem
                  key={field.label}
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => toggleHeaderField(field.label)}
                >
                  <CheckIcon
                    className={cn(
                      'size-4',
                      headerFieldVisibility[field.label] === false && 'opacity-0',
                    )}
                  />
                  {field.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={handlePrint}
            disabled={isPrintLoading}
          >
            <Printer className="size-4" />
            Drukuj
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
