'use client'

import { useState } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils/cn'
import { formatNet } from '@/lib/kosztorys/format'
import {
  sectionPieSlices,
  type SectionPieBaseT,
  type SectionSliceInputT,
} from '@/lib/kosztorys/chart-slices'
import { PieSliceLegend } from '@/components/kosztorys/pie-legend'

const BASES: { key: SectionPieBaseT; label: string }[] = [
  { key: 'przedmiar', label: 'Przedmiar' },
  { key: 'wykonane', label: 'Wykonane' },
]

// Sekcje as a share-of-whole pie, with a live Przedmiar ↔ Wykonane base toggle. Fed the client-priced,
// view-invariant subtotals so switching base is a source-selection, never a re-calculation.
export function SectionSharePie({ subtotals }: { subtotals: SectionSliceInputT[] }) {
  const [base, setBase] = useState<SectionPieBaseT>('przedmiar')
  const slices = sectionPieSlices(subtotals, base)

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">
          Udział sekcji — {base === 'przedmiar' ? 'przedmiar' : 'wykonane'}
        </span>
        <div className="border-border flex rounded-md border text-xs">
          {BASES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setBase(key)}
              className={cn(
                'px-2 py-0.5 first:rounded-l-md last:rounded-r-md',
                base === key ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </figcaption>
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
