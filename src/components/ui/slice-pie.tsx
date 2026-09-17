'use client'

import { type ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { AlertIcon } from '@/components/ui/alert-icon'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieSliceLegend, type PieSliceT } from '@/components/ui/pie-legend'
import { formatPercentPrecise } from '@/lib/kosztorys/format'

// Shared skeleton for the footer pies: recharts donut + legend. `caption` is optional — the legend
// names every slice and the surrounding tab supplies the context, so a pie only titles itself when it
// carries an `action` the title has to explain. `formatValue` renders slice figures in the tooltip
// and legend — the caller owns units/locale, so this stays domain-free. Omit it for a share-only pie:
// both fall back to the percent.
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
  // recharts derives each wedge's angle from value / totalSum. A negative total (one slice far
  // outweighing the rest, e.g. a mistyped section figure) makes that math degenerate and the pie
  // renders nothing — indistinguishable from "no data" unless we call out the bad total explicitly.
  // Zero is a legitimate default (no figures yet, or a balanced cancel-out) — only negative is a mistake.
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const isInvalidTotal = slices.length > 0 && total < 0

  // A share-of-whole chart needs shares to compare: one filled slice is always 100% of itself, so it
  // states what the table beside it already says and costs a screenful doing it. The bad-total alarm
  // still gets through — that is a data fault worth reporting whatever the slice count.
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
              content={
                <ChartTooltipContent
                  valueFormatter={(v) =>
                    formatValue
                      ? formatValue(Number(v))
                      : formatPercentPrecise(total > 0 ? Number(v) / total : null)
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
