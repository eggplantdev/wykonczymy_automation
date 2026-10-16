import { rowPlannedNetPreDiscountForView } from '@/lib/kosztorys/calc'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

export type MarginForecastT = {
  clientNet: number
  subcontractorNet: number
  margin: number
}

/**
 * The consequence to state wherever this is rendered — it is **marża before material**: on a row
 * whose client price includes material, the przedmiar carries that material's revenue and none of
 * its cost, so the forecast sits structurally above the actual and the two never converge.
 */
export function marginForecastByPlane(rows: ViewPricingT[]): Record<ToolPlaneT, MarginForecastT> {
  let clientNet = 0
  let wToolsNet = 0
  let ownToolsNet = 0
  for (const row of rows) {
    clientNet += rowPlannedNetPreDiscountForView(row, 'client')
    wToolsNet += rowPlannedNetPreDiscountForView(row, 'w_tools')
    ownToolsNet += rowPlannedNetPreDiscountForView(row, 'own_tools')
  }
  return {
    w_tools: { clientNet, subcontractorNet: wToolsNet, margin: clientNet - wToolsNet },
    own_tools: { clientNet, subcontractorNet: ownToolsNet, margin: clientNet - ownToolsNet },
  }
}
