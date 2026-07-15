'use client'

import { SimpleTooltip } from '@/components/ui/tooltip'
import { toGross } from '@/lib/kosztorys/calc'
import { formatNet as fmt, formatPercentPrecise } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

type PropsT = {
  // Both figures are netto at the active price view, over the FULL dataset — the counter answers for
  // the whole kosztorys, so the caller must not pass the filtered/sorted view.
  doneNet: number
  totalNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

const LEGEND = [
  'Wykonano — postęp całego kosztorysu, niezależnie od wyszukiwania i filtra sekcji.',
  '',
  'Procent = wartość wykonanych etapów ÷ wartość kosztorysu. Kwoty liczone przy aktywnym widoku cen.',
  'Netto/brutto podąża za przełącznikiem kwot; procent jest ten sam po obu stronach.',
  '„—" = kosztorys nie ma jeszcze wartości, więc nie ma czego dzielić.',
].join('\n')

export function KosztorysProgressCounter({ doneNet, totalNet, vatRate, moneyAxis }: PropsT) {
  // 'both' has no single answer for which side to print — netto is the figure the rest of the
  // toolbar defaults to, so only an explicit 'gross' switches the pair.
  const asGross = moneyAxis === 'gross'
  const toAxis = (net: number) => (asGross ? toGross(net, vatRate) : net)

  return (
    <SimpleTooltip content={LEGEND} delayDuration={500} className="max-w-xs whitespace-pre-line">
      <span className="text-muted-foreground cursor-help text-xs tabular-nums">
        Wykonano: {formatPercentPrecise(totalNet > 0 ? doneNet / totalNet : null)} ·{' '}
        {fmt(toAxis(doneNet))} / {fmt(toAxis(totalNet))} {asGross ? 'brutto' : 'netto'}
      </span>
    </SimpleTooltip>
  )
}
