'use client'

import { toGross } from '@/lib/kosztorys/calc'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'

type PropsT = {
  // Global discount off the executed total (net złoty, already resolved from % or zł mode), from the
  // editor hook's single source. amount 0 = no discount.
  discountAmount: number
  doZaplatyNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

export function KosztorysTotalsBar({ discountAmount, doZaplatyNet, vatRate, moneyAxis }: PropsT) {
  const hasDiscount = discountAmount > 0
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  // Suma is the total before rabat; doZaplatyNet already has it subtracted.
  const sumaNet = doZaplatyNet + discountAmount

  return (
    <div className="border-border text-foreground flex shrink-0 flex-wrap items-baseline justify-end gap-x-6 gap-y-1 border-t px-4 py-1.5 text-sm">
      {showNet && (
        <span className="font-medium">
          Suma netto <span className="tabular-nums">{fmt(sumaNet)}</span>
        </span>
      )}
      {showGross && (
        <span className="font-medium">
          Suma brutto <span className="tabular-nums">{fmt(toGross(sumaNet, vatRate))}</span>
        </span>
      )}
      {hasDiscount && (
        <span className="text-chart-green font-medium">
          Rabat <span className="tabular-nums">−{fmt(discountAmount)}</span>
        </span>
      )}
      {hasDiscount && showNet && (
        <span className="font-medium">
          Do zapłaty netto <span className="tabular-nums">{fmt(doZaplatyNet)}</span>
        </span>
      )}
      {hasDiscount && showGross && (
        <span className="font-medium">
          Do zapłaty brutto{' '}
          <span className="tabular-nums">{fmt(toGross(doZaplatyNet, vatRate))}</span>
        </span>
      )}
    </div>
  )
}
