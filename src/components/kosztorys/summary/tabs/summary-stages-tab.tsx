'use client'

import { type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { moneyPair } from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary/grid/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'
import { SectionSharePie } from '@/components/kosztorys/summary/charts/section-share-pie'
import { Description } from '@/components/ui/description'
import { KosztorysProgressCounter } from '@/components/kosztorys/summary/charts/kosztorys-progress-counter'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { stagesWithEntries } from '@/lib/kosztorys/settlement-columns'

type PropsT = {
  stages: KosztorysStageT[]
  // Per-etap „suma transzy" netto at the active view (stage id → net). Σ equals executedNet.
  stageTotals: Map<number, number>
  // R netto — suma prac wykonanych: the executed total at the active view (Σ of the etap totals).
  executedNet: number
  // Client-priced, view-invariant per-section subtotals — the „Udział sekcji" pie's structure source.
  sectionSubtotals: SectionSliceInputT[]
  vatRate: number
  // The investor's document lists only etapy with entries, like its grid and its PDF.
  preview?: boolean
}

// Both money columns regardless of the settlement mode: the pair is always computed, and reading
// robocizna means comparing what the subcontractor settles against what the client is invoiced.
const STAGES_AXIS: MoneyAxisT = 'both'

// Suma transzy per etap + the „R netto / R brutto — suma prac wykonanych" Razem readout (sheet
// r396/r397), beside the „Udział sekcji" section-share pie. Vertical like the Podsumowanie block —
// etaps are rows, Netto/Brutto are the shared money columns — so the whole panel reads on one rhythm.
export function SummaryStagesTab({
  stages,
  stageTotals,
  executedNet,
  sectionSubtotals,
  vatRate,
  preview = false,
}: PropsT) {
  const { doneNet, currentPlannedNet, rows } = useKosztorysEditorContext()
  const shownStages = preview ? stagesWithEntries(rows, stages) : stages
  if (shownStages.length === 0) return <Description withIcon={false}>Brak etapów.</Description>
  const cols = summaryMoneyCols(STAGES_AXIS)

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Above the table, like the rozliczenie selects on the other tabs — it reads the same figures
          the table lists, so it belongs at the head of the block rather than as its footnote. */}
      <KosztorysProgressCounter doneNet={doneNet} plannedNet={currentPlannedNet} />
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div>
          <SummaryTable cols={cols} className="w-fit">
            <SummaryHeaderCell variant="label">Robocizna</SummaryHeaderCell>
            <SummaryMoneyHeaders axis={STAGES_AXIS} />
            {shownStages.map((st) => (
              <SummaryRow
                key={st.id}
                label={stageLabel(st)}
                line={moneyPair(stageTotals.get(st.id) ?? 0, vatRate)}
                axis={STAGES_AXIS}
              />
            ))}
            <SummaryRow
              label="Razem"
              line={moneyPair(executedNet, vatRate)}
              axis={STAGES_AXIS}
              bold
            />
          </SummaryTable>
        </div>
        <SectionSharePie subtotals={sectionSubtotals} />
      </div>
    </div>
  )
}
