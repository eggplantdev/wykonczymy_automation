'use client'

import { DepositsTable } from '@/components/kosztorys/summary/tables/deposits-table'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { Description } from '@/components/ui/description'
import type { DepositTransactionRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  rows: DepositTransactionRowT[]
  // Decides which wpłaty are off-plane — those rows scream red in the list.
  settlementMode: SettlementModeT
  // Read-only client render — no row links.
  preview?: boolean
}

// The „Wpłaty" block — the deposits list with its gotówka/przelew split, or an empty-state line when
// there are none. The split shows in every tryb, not only mieszany (owner, 2026-08-20).
export function SummaryDepositsTab({
  investmentId,
  rows,
  settlementMode,
  preview = false,
}: PropsT) {
  if (rows.length === 0) return <Description withIcon={false}>Brak wpłat.</Description>

  return (
    <div className="flex flex-col gap-1">
      <DepositsTable
        investmentId={investmentId}
        rows={rows}
        preview={preview}
        settlementMode={settlementMode}
      />
      {!preview && (
        <Description size="xs" className="mt-2 w-fit max-w-sm text-balance">
          Wpłaty bez oznaczonej formy są traktowane jako gotówka.
        </Description>
      )}
    </div>
  )
}
