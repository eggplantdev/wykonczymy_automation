import { ChartTooltipFrame } from '@/components/ui/chart'
import type { MaterialTypeTotalT } from '@/lib/materials/types'
import { formatPLN } from '@/lib/utils/format-currency'

type TooltipPropsT = {
  active?: boolean
  payload?: { payload: MaterialTypeTotalT }[]
}

export function MaterialsTypeTooltip({ active, payload }: TooltipPropsT) {
  const total = payload?.[0]?.payload
  if (!active || !total) return null
  return (
    <ChartTooltipFrame className="min-w-48 gap-1 px-3 py-2.5">
      <span className="text-sm font-medium">{total.type}</span>
      <span className="tabular-nums">{formatPLN(total.gross)} brutto</span>
      <span className="text-muted-foreground">{total.count} materiałów</span>
    </ChartTooltipFrame>
  )
}
