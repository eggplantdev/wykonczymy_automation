'use client'

import { useState } from 'react'
import type { Where } from 'payload'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildTransferCsv } from '@/lib/export/csv'
import { triggerDownload } from '@/lib/export/download'

type CsvButtonPropsT = {
  readonly where: Where
  readonly visibleColumnIds: string[]
}

export function CsvButton({ where, visibleColumnIds }: CsvButtonPropsT) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleCsv() {
    setIsLoading(true)
    try {
      const result = await fetchFilteredTransfers(where)
      if (!result.success) {
        console.error('Export failed:', result.error)
        return
      }
      const csv = buildTransferCsv(result.data, visibleColumnIds)
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
      className="gap-1.5"
      onClick={handleCsv}
      disabled={isLoading}
      aria-label="Pobierz CSV"
    >
      {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      CSV
    </Button>
  )
}
