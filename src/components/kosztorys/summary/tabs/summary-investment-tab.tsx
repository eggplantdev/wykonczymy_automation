'use client'

import { InvestmentOverview } from '@/components/investments/investment-overview'
import type { InvestmentWithDetailsT } from '@/types/reference-data'
import type { MediaFileT } from '@/types/media'

type PropsT = {
  investment: InvestmentWithDetailsT
  trashed?: boolean
  assets?: MediaFileT[]
}

export function SummaryInvestmentTab({ investment, trashed = false, assets }: PropsT) {
  return (
    <div className="flex flex-col gap-4">
      <InvestmentOverview investment={investment} trashed={trashed} assets={assets} />
    </div>
  )
}
