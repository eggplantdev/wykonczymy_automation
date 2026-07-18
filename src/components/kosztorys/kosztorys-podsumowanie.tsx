'use client'

import {
  computeDoZaplatyRM,
  computePodsumowanie,
  moneyPair,
  type MoneyPairT,
  type SummaryLineT,
} from '@/lib/kosztorys/summary-economics'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  // Robocizna wartość netto (do zapłaty, po rabacie) — client-side, reacts to unsaved edits.
  robociznaNet: number
  // Materiały netto — live server sum of the investment's unsettled transactions.
  materialyNet: number
  // Zaliczki netto — advances already paid; subtracted from Łącznie to reach the still-owed total.
  zaliczkiNet: number
  // The rabat actually taken off the executed robocizna (net zł): the global discount when active,
  // else Σ per-item rabat. Unified upstream so this table shows one explicit „Rabat" line. 0 = none.
  rabatAmount: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

type RowOptsT = { emphasize?: boolean; discount?: boolean; negative?: boolean }

// The single bottom summary table: the robocizna waterfall (Suma prac wykonanych → Rabat →
// Robocizna) merged with the sheet Podsumowanie split (Robocizna / Materiały / Łącznie, udział %
// of Łącznie), then Zaliczki subtracted to reach „Do zapłaty" — one table, no separate totals bar.
export function KosztorysPodsumowanie({
  robociznaNet,
  materialyNet,
  zaliczkiNet,
  rabatAmount,
  vatRate,
  moneyAxis,
}: PropsT) {
  const { robocizna, materialy, lacznie } = computePodsumowanie(robociznaNet, materialyNet, vatRate)
  const doZaplaty = computeDoZaplatyRM(robociznaNet, zaliczkiNet, materialyNet, vatRate)
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  const hasDiscount = rabatAmount > 0
  const hasZaliczki = zaliczkiNet > 0
  // Suma prac wykonanych — the executed robocizna before rabat; robociznaNet already nets it off.
  const sumaPrac = moneyPair(robociznaNet + rabatAmount, vatRate)
  const rabat = moneyPair(rabatAmount, vatRate)
  const zaliczki = moneyPair(zaliczkiNet, vatRate)

  // A line with no `share` (the waterfall + total rows) renders an empty udział cell.
  const row = (label: string, line: SummaryLineT | MoneyPairT, opts: RowOptsT = {}) => {
    const cell = (value: number) => (opts.negative ? `−${formatNet(value)}` : formatNet(value))
    const money = cn('py-0.5 pr-6 text-right tabular-nums', opts.discount && 'text-chart-green')
    return (
      <tr className={opts.emphasize ? 'border-border border-t font-medium' : undefined}>
        <td className="py-0.5 pr-6">{label}</td>
        {showNet && <td className={money}>{cell(line.net)}</td>}
        {showGross && <td className={money}>{cell(line.gross)}</td>}
        <td className="text-muted-foreground py-0.5 text-right tabular-nums">
          {'share' in line ? formatPercent(line.share) : ''}
        </td>
      </tr>
    )
  }

  return (
    <div className="text-foreground px-4 py-2 text-sm">
      <table className="w-auto">
        <thead className="text-muted-foreground text-xs">
          <tr>
            <th className="pr-6 text-left font-normal">Podsumowanie</th>
            {showNet && <th className="pr-6 text-right font-normal">Netto</th>}
            {showGross && <th className="pr-6 text-right font-normal">Brutto</th>}
            <th className="text-right font-normal">Udział</th>
          </tr>
        </thead>
        <tbody>
          {hasDiscount && row('Suma prac wykonanych', sumaPrac)}
          {hasDiscount && row('Rabat', rabat, { discount: true, negative: true })}
          {row('Robocizna', robocizna)}
          {row('Materiały', materialy)}
          {row('Łącznie', lacznie, { emphasize: true })}
          {hasZaliczki && row('Zaliczki', zaliczki, { discount: true, negative: true })}
          {hasZaliczki && row('Do zapłaty', doZaplaty, { emphasize: true })}
        </tbody>
      </table>
    </div>
  )
}
