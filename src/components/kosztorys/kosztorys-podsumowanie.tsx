'use client'

import { computePodsumowanie, type SummaryLineT } from '@/lib/kosztorys/summary-economics'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

type PropsT = {
  // Robocizna wartość netto — client-side, reacts to unsaved edits (the editor's do-zapłaty total).
  robociznaNet: number
  // Materiały netto — live server sum of the investment's unsettled transactions.
  materialyNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

// Podsumowanie Robocizna / Materiały / Łącznie (sheet Podsumowanie r06–08): the split between
// the kosztorys robocizna and the investment's real material spend, with udział % of Łącznie.
export function KosztorysPodsumowanie({ robociznaNet, materialyNet, vatRate, moneyAxis }: PropsT) {
  const { robocizna, materialy, lacznie } = computePodsumowanie(robociznaNet, materialyNet, vatRate)
  const showNet = moneyAxis === 'net' || moneyAxis === 'both'
  const showGross = moneyAxis === 'gross' || moneyAxis === 'both'

  const row = (label: string, line: SummaryLineT, emphasize = false) => (
    <tr className={emphasize ? 'border-border border-t font-medium' : undefined}>
      <td className="py-0.5 pr-6">{label}</td>
      {showNet && <td className="py-0.5 pr-6 text-right tabular-nums">{formatNet(line.net)}</td>}
      {showGross && (
        <td className="py-0.5 pr-6 text-right tabular-nums">{formatNet(line.gross)}</td>
      )}
      <td className="text-muted-foreground py-0.5 text-right tabular-nums">
        {formatPercent(line.share)}
      </td>
    </tr>
  )

  return (
    <div className="border-border text-foreground shrink-0 border-t px-4 py-2 text-sm">
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
          {row('Robocizna', robocizna)}
          {row('Materiały', materialy)}
          {row('Łącznie', lacznie, true)}
        </tbody>
      </table>
    </div>
  )
}
