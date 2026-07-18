'use client'

import { useState } from 'react'
import type { Where } from 'payload'
import type { SortingState } from '@tanstack/react-table'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildTransferCsv } from '@/lib/export/csv'
import { triggerDownload } from '@/lib/export/download'
import { sortTransferRows } from '@/lib/export/sort-rows'

type CsvButtonPropsT = {
  where: Where
  visibleColumnIds: string[]
  sorting: SortingState
}

export function CsvButton({ where, visibleColumnIds, sorting }: CsvButtonPropsT) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleCsv() {
    setIsLoading(true)
    try {
      const result = await fetchFilteredTransfers(where)
      if (!result.success) {
        console.error('Export failed:', result.error)
        return
      }
      const sorted = sortTransferRows(result.data, sorting)
      const csv = buildTransferCsv(sorted, visibleColumnIds)
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const date = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `transfery-${date}.csv`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCsv}
      disabled={isLoading}
      aria-label="Pobierz CSV"
    >
      {isLoading ? <Loader2 className="animate-spin" /> : <Download />}
      CSV
    </Button>
  )
}
