'use client'

import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { formatNet } from '@/lib/kosztorys/format'
import { costPieSlices } from '@/lib/kosztorys/chart-slices'
import { PieSliceLegend } from '@/components/kosztorys/pie-legend'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// Cost split: robocizna (executed) + per-category materiały. No toggle — always executed, matching the
// sheet's r463. Same figures the summary table lists, so chart and table agree by construction.
export function CostStructurePie({
  sumaPracNet,
  materialyBreakdown,
}: {
  sumaPracNet: number
  materialyBreakdown: MaterialyBreakdownRowT[]
}) {
  const slices = costPieSlices(sumaPracNet, materialyBreakdown)

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-muted-foreground text-xs">Struktura kosztów</figcaption>
      <ChartContainer className="mx-auto h-40 w-40">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" strokeWidth={1}>
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.fill} />
            ))}
          </Pie>
          <ChartTooltip
            content={<ChartTooltipContent valueFormatter={(v) => formatNet(Number(v))} />}
          />
        </PieChart>
      </ChartContainer>
      <PieSliceLegend slices={slices} />
    </figure>
  )
}
