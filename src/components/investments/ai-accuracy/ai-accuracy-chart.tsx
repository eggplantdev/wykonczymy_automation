'use client'

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AI_ACCURACY_WINDOW, type AiAccuracyCaseScoreT } from '@/lib/kosztorys/ai-accuracy'

const PERCENT_TICKS = [0, 25, 50, 75, 100]

export function AiAccuracyChart({ cases }: { cases: AiAccuracyCaseScoreT[] }) {
  return (
    <ChartContainer className="h-72 w-full">
      <ComposedChart data={cases} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="label" tick={false} tickLine={false} axisLine={false} height={8} />
        <YAxis
          domain={[0, 100]}
          ticks={PERCENT_TICKS}
          tickFormatter={(value: number) => `${value}%`}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <ChartTooltip
          labelFormatter={(label) => String(label)}
          content={<ChartTooltipContent valueFormatter={(value) => `${String(value)}%`} />}
        />
        <Bar
          dataKey="rightPercent"
          name="AI miało dobrze"
          fill="var(--color-chart-blue)"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          dataKey="rollingPercent"
          name={`Średnia z ${AI_ACCURACY_WINDOW} ostatnich`}
          type="linear"
          stroke="var(--color-foreground)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
