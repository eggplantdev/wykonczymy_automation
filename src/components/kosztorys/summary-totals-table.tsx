'use client'

import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryRow, SummaryTable } from '@/components/kosztorys/summary-grid'

// The lower grid: deductions off Łącznie — an optional Rabat line, Wpłaty, and the bold „Do zapłaty"
// bottom line. Shares the money tracks with the breakdown above so both columns align.
export function SummaryTotalsTable({
  cols,
  moneyAxis,
  showRabat,
  rabat,
  rabatMismatch,
  wplaty,
  doZaplaty,
  investmentId,
  clientView,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  showRabat: boolean
  rabat: MoneyPairT
  rabatMismatch?: string
  wplaty: MoneyPairT
  doZaplaty: MoneyPairT
  investmentId: number
  clientView: boolean
}) {
  return (
    <SummaryTable cols={cols} className="w-fit">
      {showRabat && (
        <SummaryRow
          label="Rabat"
          line={rabat}
          axis={moneyAxis}
          discount
          noShareCell
          mismatch={rabatMismatch}
        />
      )}
      <SummaryRow
        label={
          clientView ? (
            'Wpłaty'
          ) : (
            <Link
              href={`/inwestycje/${investmentId}?type=${DEPOSIT_TYPES.join(',')}`}
              className="hover:underline"
            >
              Wpłaty
            </Link>
          )
        }
        line={wplaty}
        axis={moneyAxis}
        discount
        noBrutto
        noShareCell
      />
      <SummaryRow
        label="Do zapłaty"
        line={doZaplaty}
        axis={moneyAxis}
        bold
        danger={doZaplaty.net > 0}
        noShareCell
      />
    </SummaryTable>
  )
}
