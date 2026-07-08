'use client'

import { useState } from 'react'
import type { SortingState } from '@tanstack/react-table'
import { Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildPrintHtml } from '@/lib/export/print'
import { printViaIframe } from '@/lib/export/print-iframe'
import { formatPLN } from '@/lib/utils/format-currency'
import { BILANS_LABEL, calculateBalance } from '@/lib/export/header-fields'
import { sortTransferRows } from '@/lib/export/sort-rows'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import type { TransferTableConfigT } from '@/types/export'
import type { HeaderFieldT } from '@/types/export'

type PrintButtonPropsT = {
  config: TransferTableConfigT
  visibleColumnIds: string[]
  sorting: SortingState
}

export function PrintButton({ config, visibleColumnIds, sorting }: PrintButtonPropsT) {
  const { query, headerFields = [] } = config
  const [isLoading, setIsLoading] = useState(false)
  const storeVisibility = useHeaderFieldsStore((s) => s.visibility)

  // If store has visibility state (investment page), apply it; otherwise pass through all fields
  const hasStoreVisibility = Object.keys(storeVisibility).length > 0
  const visibleFields = hasStoreVisibility
    ? headerFields.filter((f) => storeVisibility[f.label] !== false)
    : [...headerFields]

  const bilans = calculateBalance(headerFields, storeVisibility)
  const visibleHeaderFields = [...visibleFields, { label: BILANS_LABEL, value: formatPLN(bilans) }]

  async function handlePrint() {
    setIsLoading(true)
    try {
      const result = await fetchFilteredTransfers(query.where)
      if (!result.success) {
        console.error('Print fetch failed:', result.error)
        return
      }
      const sorted = sortTransferRows(result.data, sorting)
      const title = getPrintTitle(visibleHeaderFields)
      const html = buildPrintHtml(sorted, visibleColumnIds, visibleHeaderFields, title)
      printViaIframe(html)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      disabled={isLoading}
      aria-label="Drukuj transfery"
    >
      {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
      Drukuj
    </Button>
  )
}

function getPrintTitle(headerFields: HeaderFieldT[]): string {
  return (
    headerFields.find(
      (f) => f.label === 'Inwestycja' || f.label === 'Kasa' || f.label === 'Pracownik',
    )?.value ?? 'Transfery'
  )
}
