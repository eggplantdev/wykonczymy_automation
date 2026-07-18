'use client'

import { toGross } from '@/lib/kosztorys/calc'
import { formatNet } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

type PropsT = {
  stages: KosztorysStageT[]
  // Per-etap „suma transzy" netto at the active view (stage id → net). Σ equals wykonaneNet.
  stageTotals: Map<number, number>
  // R netto — suma prac wykonanych: the executed total at the active view (Σ of the etap totals).
  wykonaneNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
}

// Suma transzy per etap + the „R netto / R brutto — suma prac wykonanych" readout (sheet r396/r397).
// Read-only: the executed value each etap delivered, at the active price view, netto and brutto.
export function KosztorysEtapTotals({
  stages,
  stageTotals,
  wykonaneNet,
  vatRate,
  moneyAxis,
}: PropsT) {
  if (stages.length === 0) return null
  const showNet = moneyAxis === 'net' || moneyAxis === 'both'
  const showGross = moneyAxis === 'gross' || moneyAxis === 'both'
  const money = (net: number, gross: boolean) => formatNet(gross ? toGross(net, vatRate) : net)

  return (
    <div className="border-border text-foreground shrink-0 overflow-x-auto border-t px-4 py-2 text-sm">
      <table className="w-auto">
        <thead className="text-muted-foreground text-xs">
          <tr>
            <th className="pr-6 text-left font-normal">Suma transzy</th>
            {stages.map((st) => (
              <th key={st.id} className="pr-6 text-right font-normal">
                {st.label ?? `Etap ${st.ordinal}`}
              </th>
            ))}
            <th className="text-right font-normal">Suma prac wykonanych</th>
          </tr>
        </thead>
        <tbody>
          {showNet && (
            <tr>
              <td className="py-0.5 pr-6">Netto</td>
              {stages.map((st) => (
                <td key={st.id} className="py-0.5 pr-6 text-right tabular-nums">
                  {money(stageTotals.get(st.id) ?? 0, false)}
                </td>
              ))}
              <td className="py-0.5 text-right font-medium tabular-nums">
                {money(wykonaneNet, false)}
              </td>
            </tr>
          )}
          {showGross && (
            <tr>
              <td className="py-0.5 pr-6">Brutto</td>
              {stages.map((st) => (
                <td key={st.id} className="py-0.5 pr-6 text-right tabular-nums">
                  {money(stageTotals.get(st.id) ?? 0, true)}
                </td>
              ))}
              <td className="py-0.5 text-right font-medium tabular-nums">
                {money(wykonaneNet, true)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
