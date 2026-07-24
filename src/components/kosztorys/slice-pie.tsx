'use client'

import { type ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { formatNet } from '@/lib/kosztorys/format'
import { PieSliceLegend } from '@/components/kosztorys/pie-legend'
import type { PieSliceT } from '@/lib/kosztorys/chart-slices'

// Shared figure skeleton for the footer pies — recharts donut + legend, with the `<figcaption>` baked
// in so callers pass only their label. `action` fills an optional control on the caption's right (the
// section pie's Przedmiar↔Wykonane toggle); without it the label stands alone.
export function SlicePie({
  caption,
  action,
  slices,
}: {
  caption: string
  action?: ReactNode
  slices: PieSliceT[]
}) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className={action ? 'flex items-center justify-between gap-3' : undefined}>
        <span className="text-muted-foreground text-xs">{caption}</span>
        {action}
      </figcaption>
      <ChartContainer className="mx-auto h-40 w-40">
        <PieChart>
          {/* Each summary tab mounts fresh on switch, so the default intro sweep would replay on every
              tab change — off, since the pie is a static readout, not a transition. */}
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            strokeWidth={1}
            isAnimationActive={false}
          >
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
