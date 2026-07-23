'use client'

import { toGross } from '@/lib/kosztorys/calc'
import { type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary-row'
import { summaryMoneyCols, type MutedAxisT } from '@/components/kosztorys/summary-axis'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

type PropsT = {
  stages: KosztorysStageT[]
  // Per-etap „suma transzy" netto at the active view (stage id → net). Σ equals wykonaneNet.
  stageTotals: Map<number, number>
  // R netto — suma prac wykonanych: the executed total at the active view (Σ of the etap totals).
  wykonaneNet: number
  vatRate: number
  moneyAxis: MoneyAxisT
  // Which money column (Netto or Brutto) is greyed while both show; undefined in Mieszane.
  mutedAxis?: MutedAxisT
}

// Suma transzy per etap + the „R netto / R brutto — suma prac wykonanych" Razem readout (sheet
// r396/r397). Vertical like the Podsumowanie block above it — etaps are rows, Netto/Brutto are the
// shared money columns — so the whole panel reads on one rhythm.
export function KosztorysStageTotals({
  stages,
  stageTotals,
  wykonaneNet,
  vatRate,
  moneyAxis,
  mutedAxis,
}: PropsT) {
  if (stages.length === 0) return null
  const pair = (net: number): MoneyPairT => ({ net, gross: toGross(net, vatRate) })
  const cols = summaryMoneyCols(moneyAxis)

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">Robocizna per etap</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} mutedAxis={mutedAxis} />
      {stages.map((st) => (
        <SummaryRow
          key={st.id}
          label={st.label ?? `Etap ${st.ordinal}`}
          line={pair(stageTotals.get(st.id) ?? 0)}
          axis={moneyAxis}
          mutedAxis={mutedAxis}
        />
      ))}
      <SummaryRow
        label="Razem"
        line={pair(wykonaneNet)}
        axis={moneyAxis}
        mutedAxis={mutedAxis}
        emphasize
      />
    </SummaryTable>
  )
}
