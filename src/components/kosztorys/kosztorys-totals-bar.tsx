'use client'

import { toGross } from '@/lib/kosztorys/calc'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

type PropsT = {
  totalNet: number
  // Global discount off the executed total + the payable, both from the editor hook's single source
  // (shared with the Sekcje Suma block). amount 0 = no discount → only the plain sum shows.
  discountAmount: number
  doZaplatyNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

// The same figures as the Sekcje Suma block — read as props so the two surfaces can't disagree.
export function KosztorysTotalsBar({
  totalNet,
  discountAmount,
  doZaplatyNet,
  vatRate,
  moneyAxis,
}: PropsT) {
  const hasDiscount = discountAmount > 0
  const showNet = moneyAxis === 'net' || moneyAxis === 'both'
  const showGross = moneyAxis === 'gross' || moneyAxis === 'both'
  const netLabel = hasDiscount ? 'Do zapłaty netto' : 'Suma netto'
  const grossLabel = hasDiscount ? 'Do zapłaty brutto' : 'Suma brutto'

  return (
    <div className="border-border text-foreground flex shrink-0 flex-wrap items-baseline justify-end gap-x-6 gap-y-1 border-t px-4 py-1.5 text-sm">
      {hasDiscount && showNet && (
        <span className="text-muted-foreground text-xs">
          Suma netto <span className="tabular-nums">{fmt(totalNet)}</span> · − Rabat{' '}
          <span className="tabular-nums">{fmt(discountAmount)}</span>
        </span>
      )}
      {showNet && (
        <span className="font-medium">
          {netLabel} <span className="tabular-nums">{fmt(doZaplatyNet)}</span>
        </span>
      )}
      {showGross && (
        <span className="font-medium">
          {grossLabel} <span className="tabular-nums">{fmt(toGross(doZaplatyNet, vatRate))}</span>
        </span>
      )}
    </div>
  )
}
