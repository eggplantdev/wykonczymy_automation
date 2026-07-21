'use client'

import { type ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { formatNet } from '@/lib/kosztorys/format'
import { PieSliceLegend } from '@/components/kosztorys/pie-legend'
import type { PieSliceT } from '@/lib/kosztorys/chart-slices'

// Shared figure skeleton for both footer pies — recharts donut + legend. Each caller supplies only
// its own `<figcaption>` and slice set, so the two pies stay visually identical by construction.
export function SlicePie({ caption, slices }: { caption: ReactNode; slices: PieSliceT[] }) {
  return (
    <figure className="flex flex-col gap-3">
      {caption}
      <ChartContainer className="mx-auto h-40 w-40">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" strokeWidth={1}>
            {slices.map((slice) => (
              <Cell key={slice.id} fill={slice.fill} />
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
