'use client'

import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { formatWholePercent } from './format'

const GRADIENT_ID = 'ai-accuracy-gauge'

export function AccuracyGauge({ percent, caption }: { percent: number; caption: string }) {
  return (
    <div className="relative mx-auto size-56 shrink-0">
      <ChartContainer className="size-full">
        <RadialBarChart
          data={[{ value: percent }]}
          innerRadius="80%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
        >
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-blue)" />
              <stop offset="100%" stopColor="var(--color-chart-purple)" />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar
            dataKey="value"
            background={{ fill: 'var(--color-muted)' }}
            cornerRadius={12}
            fill={`url(#${GRADIENT_ID})`}
            animationDuration={1200}
          />
        </RadialBarChart>
      </ChartContainer>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="from-chart-blue to-chart-purple bg-linear-to-br bg-clip-text text-5xl font-bold text-transparent tabular-nums">
          {formatWholePercent(percent)}
        </span>
        <span className="text-muted-foreground text-xs">{caption}</span>
      </div>
    </div>
  )
}
