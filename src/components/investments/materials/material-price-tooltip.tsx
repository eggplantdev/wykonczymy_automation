import { ChartTooltipFrame } from '@/components/ui/chart'
import { formatQty } from '@/lib/kosztorys/format'
import type { MaterialPricePointT } from '@/lib/materials/types'
import { formatPLN } from '@/lib/utils/format-currency'

type PropsT = {
  active?: boolean
  payload?: { payload: MaterialPricePointT }[]
}

export function MaterialPriceTooltip({ active, payload }: PropsT) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <ChartTooltipFrame className="min-w-52 gap-1 px-3 py-2.5">
      <span className="text-sm font-medium">{point.shop}</span>
      <span className="text-muted-foreground">
        {point.date} · {point.doc}
      </span>
      <span className="tabular-nums">
        {formatPLN(point.net)} netto × {formatQty(point.qty)}
      </span>
    </ChartTooltipFrame>
  )
}
