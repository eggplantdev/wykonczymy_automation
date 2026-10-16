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
  stageTotals: Map<number, number>
  executedNet: number
  sectionSubtotals: SectionSliceInputT[]
  vatRate: number
  preview?: boolean
}

const STAGES_AXIS: MoneyAxisT = 'both'

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
