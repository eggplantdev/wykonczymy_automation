'use client'

import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { Description } from '@/components/ui/description'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { AI_ACCURACY_WINDOW, type AiAccuracyCaseScoreT } from '@/lib/kosztorys/ai-accuracy'
import { cn } from '@/lib/utils/cn'
import { ACCURACY_BANDS, accuracyBand } from './accuracy-bands'
import { AccuracyTrendTooltip } from './accuracy-trend-tooltip'
import { formatWholePercent } from './format'

const PERCENT_TICKS = [0, 25, 50, 75, 100]
const AXIS_TICK = { fill: 'var(--color-muted-foreground)' }
const ROLLING_GRADIENT_ID = 'ai-accuracy-rolling'
const bandGradientId = (bandId: string) => `ai-accuracy-band-${bandId}`

type PropsT = {
  cases: AiAccuracyCaseScoreT[]
  allPercent: number
}

export function AiAccuracyChart({ cases, allPercent }: PropsT) {
  const data = cases.map((score, index) => ({ ...score, order: index + 1 }))

  return (
    <div className="grid gap-4">
      <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {ACCURACY_BANDS.map((band) => (
          <li key={band.id} className="flex items-center gap-2">
            <span className={cn('size-3 rounded-xs', band.swatch)} />
            {band.label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="bg-chart-purple h-0.5 w-5 rounded-full" />
          Średnia z {AI_ACCURACY_WINDOW} ostatnich
        </li>
        <li className="flex items-center gap-2">
          <span className="border-muted-foreground w-5 border-t-2 border-dashed" />
          Średnia ze wszystkich ({formatWholePercent(allPercent)})
        </li>
      </ul>
      <ChartContainer className="h-80 w-full">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {ACCURACY_BANDS.map((band) => (
              <linearGradient
                key={band.id}
                id={bandGradientId(band.id)}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={band.color} />
                <stop offset="100%" stopColor={band.color} stopOpacity={0.4} />
              </linearGradient>
            ))}
            <linearGradient id={ROLLING_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-purple)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-chart-purple)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="order"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            domain={[0, 100]}
            ticks={PERCENT_TICKS}
            tick={AXIS_TICK}
            tickFormatter={(value: number) => `${value}%`}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <ChartTooltip
            cursor={{ fill: 'var(--color-muted)', opacity: 0.6 }}
            content={<AccuracyTrendTooltip />}
          />
          <ReferenceLine
            y={allPercent}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="4 4"
          />
          <Bar dataKey="rightPercent" maxBarSize={24} radius={[4, 4, 0, 0]}>
            {data.map((score) => (
              <Cell
                key={score.investmentId}
                fill={`url(#${bandGradientId(accuracyBand(score.rightPercent).id)})`}
              />
            ))}
          </Bar>
          <Area
            dataKey="rollingPercent"
            type="monotone"
            stroke="var(--color-chart-purple)"
            strokeWidth={2.5}
            fill={`url(#${ROLLING_GRADIENT_ID})`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-background)' }}
          />
        </ComposedChart>
      </ChartContainer>
      <Description size="xs" withIcon={false}>
        Każdy słupek to jeden przypadek, w kolejności dodania inwestycji. Najedź, żeby zobaczyć,
        która to inwestycja.
      </Description>
    </div>
  )
}
