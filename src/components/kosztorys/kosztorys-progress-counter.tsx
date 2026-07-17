'use client'

import { HintTooltip } from '@/components/ui/tooltip'
import { toGross } from '@/lib/kosztorys/calc'
import { formatNet as fmt, formatPercentPrecise } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

type PropsT = {
  // Both figures are netto at the active price view, over the FULL dataset — the counter answers for
  // the whole kosztorys, so the caller must not pass the filtered/sorted view.
  doneNet: number
  plannedNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

const LEGEND = 'Procent = wartość wykonanych etapów ÷ wartość przedmiaru wg ceny klienta.'

export function KosztorysProgressCounter({ doneNet, plannedNet, vatRate, moneyAxis }: PropsT) {
  // No przedmiar → nothing to divide by, so the whole counter is meaningless — render nothing.
  if (plannedNet <= 0) return null

  // 'both' has no single answer for which side to print — netto is the figure the rest of the
  // toolbar defaults to, so only an explicit 'gross' switches the pair.
  const asGross = moneyAxis === 'gross'
  const toAxis = (net: number) => (asGross ? toGross(net, vatRate) : net)

  const ratio = doneNet / plannedNet
  // Bar caps at full; the percent text still shows the real >100% overrun.
  const barPct = Math.min(ratio, 1) * 100

  const amounts = `${fmt(toAxis(doneNet))} / ${fmt(toAxis(plannedNet))} ${asGross ? 'brutto' : 'netto'}`
  const tooltip = [amounts, '', LEGEND].join('\n')

  return (
    <HintTooltip content={tooltip} className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs tabular-nums">
        Postęp prac: {formatPercentPrecise(ratio)}
      </span>
      <span
        role="progressbar"
        aria-label="Wykonano"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(barPct)}
        className="bg-border h-1.5 w-24 shrink-0 rounded-full"
      >
        {/* Dynamic percentage width — the one value Tailwind can't express as a token. */}
        <span
          className="from-chart-green via-chart-teal to-chart-turquoise progress-glow block h-full rounded-full bg-linear-to-r transition-[width]"
          style={{ width: `${barPct}%` }}
        />
      </span>
    </HintTooltip>
  )
}
