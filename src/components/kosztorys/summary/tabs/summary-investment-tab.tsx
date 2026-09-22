'use client'

import { InfoList } from '@/components/ui/info-list'
import { buildInvestmentInfoFields } from '@/components/investments/investment-info-fields'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { InvestmentAssetsControl } from '@/components/investments/investment-assets-control'
import type { InvestmentRefT } from '@/types/reference-data'
import type { MediaFileT } from '@/types/media'

type PropsT = {
  investment: InvestmentRefT
  // The gate stands here, not in the control: the control is shared with the investment card, where
  // `assets` is required. `undefined` = a surface with no gallery at all.
  assets?: MediaFileT[]
}

export function SummaryInvestmentTab({ investment, assets }: PropsT) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {assets && <InvestmentAssetsControl investmentId={investment.id} assets={assets} />}
        <EditInvestmentDialog investment={investment} showLabel />
      </div>
      <InfoList items={buildInvestmentInfoFields(investment)} />
    </div>
  )
}
