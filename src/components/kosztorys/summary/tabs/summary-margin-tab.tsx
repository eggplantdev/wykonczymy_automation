'use client'

import {
  FIGURE_OPTIONS,
  useMarginFigure,
  useMarginPlane,
} from '@/components/kosztorys/summary/hooks/use-margin-reading'
import { MarginActualTable } from '@/components/kosztorys/summary/tabs/margin-actual-table'
import { MarginForecastTable } from '@/components/kosztorys/summary/tabs/margin-forecast-table'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { SubcontractorSettlementT } from '@/lib/kosztorys/subcontractor-due'
import type { MarginForecastT } from '@/lib/kosztorys/margin-forecast'
import { financialsOnReading, type SummaryReadingT } from '@/lib/kosztorys/summary-reading'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

type PropsT = {
  financials: InvestmentFinancialsT
  subcontractor: SubcontractorSettlementT
  forecastByPlane?: Record<ToolPlaneT, MarginForecastT>
} & SummaryReadingT

// Visibility is enforced upstream by the host omitting `financials` for anyone
// but ADMIN/OWNER —
// so this component carries no role check of its own.
export function SummaryMarginTab({
  financials,
  laborCostsNet,
  discountAmount,
  subcontractor,
  forecastByPlane,
}: PropsT) {
  const [figure, setFigure] = useMarginFigure()
  const [plane, setPlane] = useMarginPlane()

  const forecast = forecastByPlane?.[plane]

  return (
    <div className="flex w-full flex-col gap-4">
      {forecastByPlane && (
        <div className="w-fit">
          <ToggleGroup
            options={FIGURE_OPTIONS}
            value={figure}
            onChange={setFigure}
            aria-label="Która marża"
          />
        </div>
      )}

      {figure === 'forecast' && forecast ? (
        <MarginForecastTable forecast={forecast} plane={plane} onPlaneChange={setPlane} />
      ) : (
        <MarginActualTable
          financials={financialsOnReading(financials, { laborCostsNet, discountAmount })}
          subcontractor={subcontractor}
        />
      )}
    </div>
  )
}
