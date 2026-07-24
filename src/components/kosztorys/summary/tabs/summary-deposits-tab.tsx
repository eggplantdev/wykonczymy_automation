'use client'

import { DepositsTable } from '@/components/kosztorys/summary/tables/deposits-table'
import { SlicePie } from '@/components/ui/slice-pie'
import { Description } from '@/components/ui/description'
import { depositPlanePieSlices } from '@/lib/kosztorys/chart-slices'
import { formatNet } from '@/lib/kosztorys/format'
import type { DepositTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  rows: DepositTransactionRowT[]
  // Tryb mieszany — adds the „Rozliczenie netto/brutto" plane column + the netto-default note, and
  // shows the netto/brutto share pie (the plane split only exists in this mode).
  showPlane: boolean
  // Wpłaty split by VAT plane — feeds the plane pie. Only meaningful (and shown) when showPlane.
  paidNet: number
  paidGross: number
  // Read-only client render — no row links.
  clientView?: boolean
}

// The „Wpłaty" view: the sortable deposits list, or an empty-state line when there are none. In tryb
// mieszany it adds a netto/brutto share pie beside the list.
export function SummaryDepositsTab({
  investmentId,
  rows,
  showPlane,
  paidNet,
  paidGross,
  clientView = false,
}: PropsT) {
  if (rows.length === 0) return <Description withIcon={false}>Brak wpłat.</Description>

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      <div className="flex flex-col gap-1">
        <DepositsTable
          investmentId={investmentId}
          rows={rows}
          clientView={clientView}
          showPlane={showPlane}
        />
        <Description className="mt-2 w-fit max-w-sm text-xs text-balance">
          Wpłaty bez oznaczenia netto/brutto są traktowane jako netto.
        </Description>
      </div>
      {showPlane && (
        <SlicePie
          caption="Udział wpłat netto / brutto"
          slices={depositPlanePieSlices(paidNet, paidGross)}
          formatValue={formatNet}
        />
      )}
    </div>
  )
}
