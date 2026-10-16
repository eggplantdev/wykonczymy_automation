'use client'

import { DepositsTable } from '@/components/kosztorys/summary/tables/deposits-table'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { Description } from '@/components/ui/description'
import type { DepositTransactionRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  rows: DepositTransactionRowT[]
  settlementMode: SettlementModeT
  preview?: boolean
}

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
