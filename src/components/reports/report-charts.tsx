'use client'

import { Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { formatPLN } from '@/lib/format-currency'
import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'

type ReportChartPropsT = {
  readonly financials: InvestmentFinancialsT
}

export function ReportChart({ financials }: ReportChartPropsT) {
  const data = [
    { name: 'Materiały', value: financials.totalCosts, fill: 'var(--color-chart-red)' },
    { name: 'Robocizna', value: financials.totalLaborCosts, fill: 'var(--color-chart-yellow)' },
    { name: 'Wpływy', value: financials.totalIncome, fill: 'var(--color-chart-green)' },
  ]

  if (data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Brak danych</p>
  }

  return (
    <ChartContainer className="mx-auto h-[300px] w-[300px]">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" />
        <ChartTooltip content={<ChartTooltipContent valueFormatter={plnFormatter} />} />
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  )
}

function plnFormatter(value: unknown) {
  return formatPLN(Number(value))
}
