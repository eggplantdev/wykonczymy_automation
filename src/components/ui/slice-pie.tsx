'use client'

import { type ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { AlertIcon } from '@/components/ui/alert-icon'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieSliceLegend, type PieSliceT } from '@/components/ui/pie-legend'
import { formatPercent } from '@/lib/kosztorys/format'

export function SlicePie({
  caption,
  action,
  slices,
  formatValue,
}: {
  caption?: string
  action?: ReactNode
  slices: PieSliceT[]
  formatValue?: (value: number) => string
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const isInvalidTotal = slices.length > 0 && total < 0

  if (!isInvalidTotal && slices.filter((slice) => slice.value !== 0).length < 2) return null

  return (
    // `w-full`: hosts stack this with `items-start`, which sizes to content — without it the legend
    // widens to its longest sekcja name and pushes off a phone screen instead of truncating.
    <figure className="flex w-full min-w-0 flex-col gap-3 sm:max-w-md">
      {(caption || action) && (
        <figcaption>
          {caption && <span className="text-muted-foreground mr-4 text-xs">{caption}</span>}
          {action}
        </figcaption>
      )}
      {isInvalidTotal ? (
        <div className="text-destructive mx-auto flex h-40 w-40 flex-col items-center justify-center gap-2 text-center text-xs">
          <AlertIcon className="size-5" />
          <span>Błędne dane: suma wartości jest ujemna.</span>
        </div>
      ) : (
        <ChartContainer className="mx-auto h-40 w-40">
          <PieChart>
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
              content={
                <ChartTooltipContent
                  valueFormatter={(v) =>
                    formatValue
                      ? formatValue(Number(v))
                      : formatPercent(total > 0 ? Number(v) / total : null)
                  }
                />
              }
            />
          </PieChart>
        </ChartContainer>
      )}
      <PieSliceLegend slices={slices} formatValue={formatValue} />
    </figure>
  )
}
