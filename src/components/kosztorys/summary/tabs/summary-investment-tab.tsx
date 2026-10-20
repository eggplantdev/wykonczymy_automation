'use client'

import { InfoList } from '@/components/ui/info-list'
import { buildInvestmentInfoFields } from '@/components/investments/investment-info-fields'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { InvestmentAssetsControl } from '@/components/investments/investment-assets-control'
import { InvestmentAiNotes } from '@/components/investments/investment-ai-notes'
import { InvestmentNotes } from '@/components/investments/investment-notes'
import type { InvestmentWithDetailsT, WorkerRefT } from '@/types/reference-data'
import type { MediaFileT } from '@/types/media'

type PropsT = {
  investment: InvestmentWithDetailsT
  assets?: MediaFileT[]
  workers?: WorkerRefT[]
}

export function SummaryInvestmentTab({ investment, assets, workers }: PropsT) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {assets && <InvestmentAssetsControl investmentId={investment.id} assets={assets} />}
        <EditInvestmentDialog investment={investment} workers={workers} showLabel />
      </div>
      <InfoList items={buildInvestmentInfoFields(investment)} />
      <InvestmentNotes investment={investment} />
      <InvestmentAiNotes aiNotes={investment.aiNotes} />
    </div>
  )
}
