'use client'

import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import type { AiAccuracyT } from '@/lib/kosztorys/ai-accuracy'
import { AccuracyRepeatTooltip } from './accuracy-repeat-tooltip'
import { formatCompactZloty } from './format'

const ROW_HEIGHT = 34
const TICK_CHARS = 34
const GRADIENT_ID = 'ai-accuracy-repeats'

const shortTick = (name: string) =>
  name.length > TICK_CHARS ? `${name.slice(0, TICK_CHARS - 1).trimEnd()}…` : name

export function AccuracyRepeatsChart({ repeats }: { repeats: AiAccuracyT['repeats'] }) {
  return (
    <ChartContainer className="w-full" style={{ height: ROW_HEIGHT * repeats.length }}>
      <BarChart
        data={repeats}
        layout="vertical"
        margin={{ top: 0, right: 64, bottom: 0, left: 0 }}
        barCategoryGap={10}
      >
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-chart-orange)" />
            <stop offset="100%" stopColor="var(--color-chart-pink)" />
          </linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="pozycja"
          width={240}
          tick={{ fill: 'var(--color-foreground)' }}
          tickFormatter={shortTick}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--color-muted)', opacity: 0.6 }}
          content={<AccuracyRepeatTooltip />}
        />
        <Bar dataKey="wrongZl" fill={`url(#${GRADIENT_ID})`} radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="wrongZl"
            position="right"
            fill="var(--color-muted-foreground)"
            formatter={(value: unknown) => formatCompactZloty(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
