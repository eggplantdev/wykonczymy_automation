'use client'

import { useState } from 'react'
import { Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildPrintHtml } from '@/lib/export/print'
import { printViaIframe } from '@/lib/export/print-iframe'
import { formatPLN } from '@/lib/format-currency'
import { BILANS_LABEL, calculateBilans } from '@/lib/export/header-fields'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import type { TransferTableConfigT } from '@/types/export'
import type { HeaderFieldT } from '@/types/export'

type PrintButtonPropsT = {
  readonly config: TransferTableConfigT
  readonly visibleColumnIds: string[]
}

export function PrintButton({ config, visibleColumnIds }: PrintButtonPropsT) {
  const { query, headerFields = [] } = config
  const [isLoading, setIsLoading] = useState(false)
  const storeVisibility = useHeaderFieldsStore((s) => s.visibility)

  // If store has visibility state (investment page), apply it; otherwise pass through all fields
  const hasStoreVisibility = Object.keys(storeVisibility).length > 0
  const visibleFields = hasStoreVisibility
    ? headerFields.filter((f) => storeVisibility[f.label] !== false)
    : [...headerFields]

  const bilans = calculateBilans(headerFields, storeVisibility)
  const visibleHeaderFields = [...visibleFields, { label: BILANS_LABEL, value: formatPLN(bilans) }]

  async function handlePrint() {
    setIsLoading(true)
    try {
      const result = await fetchFilteredTransfers(query.where)
      if (!result.success) {
        console.error('Print fetch failed:', result.error)
        return
      }
      const title = getPrintTitle(visibleHeaderFields)
      const html = buildPrintHtml(result.data, visibleColumnIds, visibleHeaderFields, title)
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
    headerFields.find((f) => f.label === 'Inwestycja' || f.label === 'Kasa')?.value ?? 'Transfery'
  )
}
