'use client'

import { type ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieSliceLegend, type PieSliceT } from '@/components/ui/pie-legend'

// Shared skeleton for the footer pies: recharts donut + legend. `action` is an optional control on the
// caption's right; without it the label stands alone. `formatValue` renders slice figures in the tooltip
// and legend — the caller owns units/locale, so this stays domain-free.
export function SlicePie({
  caption,
  action,
  slices,
  formatValue,
}: {
  caption: string
  action?: ReactNode
  slices: PieSliceT[]
  formatValue: (value: number) => string
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
            content={<ChartTooltipContent valueFormatter={(v) => formatValue(Number(v))} />}
          />
        </PieChart>
      </ChartContainer>
      <PieSliceLegend slices={slices} formatValue={formatValue} />
    </figure>
  )
}
