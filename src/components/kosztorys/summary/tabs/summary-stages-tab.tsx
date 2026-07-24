'use client'

import { type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { moneyPair } from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary/grid/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'
import { SectionSharePie } from '@/components/kosztorys/summary/charts/section-share-pie'
import { KosztorysProgressCounter } from '@/components/kosztorys/summary/charts/kosztorys-progress-counter'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

type PropsT = {
  stages: KosztorysStageT[]
  // Per-etap „suma transzy" netto at the active view (stage id → net). Σ equals wykonaneNet.
  stageTotals: Map<number, number>
  // R netto — suma prac wykonanych: the executed total at the active view (Σ of the etap totals).
  wykonaneNet: number
  // Client-priced, view-invariant per-section subtotals — the „Udział sekcji" pie's structure source.
  sectionSubtotals: SectionSliceInputT[]
  vatRate: number
  moneyAxis: MoneyAxisT
}

// Suma transzy per etap + the „R netto / R brutto — suma prac wykonanych" Razem readout (sheet
// r396/r397), beside the „Udział sekcji" section-share pie. Vertical like the Podsumowanie block —
// etaps are rows, Netto/Brutto are the shared money columns — so the whole panel reads on one rhythm.
export function SummaryStagesTab({
  stages,
  stageTotals,
  wykonaneNet,
  sectionSubtotals,
  vatRate,
  moneyAxis,
}: PropsT) {
  const { doneNet, plannedNet } = useKosztorysEditorContext()
  if (stages.length === 0) return null
  const cols = summaryMoneyCols(moneyAxis)

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div>
          <SummaryTable cols={cols} className="w-fit">
            <SummaryHeaderCell variant="label">Robocizna</SummaryHeaderCell>
            <SummaryMoneyHeaders axis={moneyAxis} />
            {stages.map((st) => (
              <SummaryRow
                key={st.id}
                label={st.label ?? `Etap ${st.ordinal}`}
                line={moneyPair(stageTotals.get(st.id) ?? 0, vatRate)}
                axis={moneyAxis}
              />
            ))}
            <SummaryRow
              label="Razem"
              line={moneyPair(wykonaneNet, vatRate)}
              axis={moneyAxis}
              bold
            />
          </SummaryTable>
          <KosztorysProgressCounter doneNet={doneNet} plannedNet={plannedNet} />
        </div>
        <SectionSharePie subtotals={sectionSubtotals} />
      </div>
    </div>
  )
}
