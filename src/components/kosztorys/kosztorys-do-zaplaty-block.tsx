'use client'

import { cn } from '@/lib/utils/cn'
import { formatNet } from '@/lib/kosztorys/format'
import type { DepositBucketsT, MoneyPairT } from '@/lib/kosztorys/summary-economics'

type PropsT = {
  deposits: DepositBucketsT
  doZaplaty: MoneyPairT
}

// One netto/brutto figure: „Wpłaty netto 1000 brutto 1080".
function Figure({
  label,
  netto,
  brutto,
  bold,
  danger,
}: {
  label: string
  netto: number
  brutto: number
  bold?: boolean
  danger?: boolean
}) {
  const valueClass = cn(
    'text-foreground tabular-nums',
    bold && 'font-medium',
    danger && 'text-destructive',
  )
  return (
    <span className="inline-flex items-baseline gap-x-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-baseline gap-x-1">
        <span className="text-muted-foreground text-xs">netto</span>
        <span className={valueClass}>{formatNet(netto)}</span>
      </span>
      <span className="inline-flex items-baseline gap-x-1">
        <span className="text-muted-foreground text-xs">brutto</span>
        <span className={valueClass}>{formatNet(brutto)}</span>
      </span>
    </span>
  )
}

// The four locked figures — Wpłaty netto/brutto + Do zapłaty netto/brutto — as one hide-exempt set.
// Both are always shown regardless of the MoneyAxisToggle (unlike the axis-gated waterfall). Rendered
// from this single source in BOTH the collapsed headline (kosztorys-totals-panel) and the expanded
// Podsumowanie (kosztorys-summary), so the two paths cannot drift. Legacy (NULL-plane) deposits
// surface as a separate amber line when present — they still reduced the base at face value.
export function KosztorysDoZaplatyBlock({ deposits, doZaplaty }: PropsT) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      <Figure label="Wpłaty" netto={deposits.sumNet} brutto={deposits.sumGross} />
      <Figure
        label="Do zapłaty"
        netto={doZaplaty.net}
        brutto={doZaplaty.gross}
        bold
        danger={doZaplaty.net > 0}
      />
      {deposits.legacySum !== 0 && (
        <span className="text-chart-orange tabular-nums">
          Wpłaty bez oznaczenia netto/brutto: {formatNet(deposits.legacySum)}
        </span>
      )}
    </span>
  )
}
