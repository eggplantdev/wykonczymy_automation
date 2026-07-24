'use client'

import { DepositsTable } from '@/components/kosztorys/deposits-table'
import { Description } from '@/components/ui/description'
import type { DepositTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  rows: DepositTransactionRowT[]
  // Tryb mieszany — adds the „Rozliczenie netto/brutto" plane column + the netto-default note.
  showPlane: boolean
  // Read-only client render — no row links.
  clientView?: boolean
}

// The „Wpłaty" view: the sortable deposits list, or an empty-state line when there are none.
export function SummaryDepositsTab({ investmentId, rows, showPlane, clientView = false }: PropsT) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">Brak wpłat.</p>

  return (
    <div className="flex flex-col gap-1">
      <DepositsTable
        investmentId={investmentId}
        rows={rows}
        clientView={clientView}
        showPlane={showPlane}
      />
      <Description className="w-fit max-w-sm text-xs text-balance">
        Wpłaty bez oznaczenia netto/brutto są traktowane jako netto.
      </Description>
    </div>
  )
}
