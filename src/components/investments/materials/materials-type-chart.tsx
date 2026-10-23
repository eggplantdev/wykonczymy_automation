'use client'

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import type { MaterialTypeTotalT } from '@/lib/materials/types'
import { MaterialsTypeTooltip } from './materials-type-tooltip'

const AXIS_TICK = { fill: 'var(--color-muted-foreground)' }
const GRADIENT_ID = 'materials-type-bar'
const ROW_HEIGHT = 32

const formatThousands = (amount: number) => `${Math.round(amount / 1000)} tys.`

export function MaterialsTypeChart({ totals }: { totals: MaterialTypeTotalT[] }) {
  return (
    <ChartContainer className="w-full" style={{ height: totals.length * ROW_HEIGHT + 16 }}>
      <BarChart data={totals} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-chart-blue)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--color-chart-blue)" />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="type"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={170}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--color-muted)', opacity: 0.6 }}
          content={<MaterialsTypeTooltip />}
        />
        <Bar dataKey="gross" fill={`url(#${GRADIENT_ID})`} radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList
            dataKey="gross"
            position="right"
            formatter={(value: number) => formatThousands(value)}
            className="fill-muted-foreground text-xs tabular-nums"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
