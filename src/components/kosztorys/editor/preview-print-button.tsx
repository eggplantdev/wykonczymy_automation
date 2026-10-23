'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOfferPrint } from '@/components/kosztorys/editor/actions/use-offer-print'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'

export function PreviewPrintButton({
  clientView,
  hasRows,
  showAllRows,
}: {
  clientView: ClientViewSettingsT
  hasRows: boolean
  showAllRows: boolean
}) {
  const printOffer = useOfferPrint()
  return (
    <Button
      size="lg"
      variant="outline"
      disabled={!hasRows}
      className="max-sm:w-10 max-sm:px-0"
      onClick={() =>
        printOffer({ ...clientView, hideEmptyRows: clientView.hideEmptyRows && !showAllRows })
      }
    >
      <Printer />
      <span className="max-sm:sr-only">Drukuj</span>
    </Button>
  )
}
