'use client'

import { Pie, PieChart } from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TRANSFER_TYPE_LABELS, type TransferTypeT } from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/format-currency'
import type { CostBreakdownT, TypeTotalT } from '@/lib/db/sum-transfers'

type ReportChartsPropsT = {
  readonly costBreakdown: CostBreakdownT
  readonly typeDistribution: readonly TypeTotalT[]
}

const COST_CONFIG = {
  investmentExpenses: { label: 'Wydatki inwestycyjne', color: 'var(--chart-1)' },
  employeeExpenses: { label: 'Wydatki pracownicze', color: 'var(--chart-2)' },
  laborCosts: { label: 'Koszty robocizny', color: 'var(--chart-3)' },
} satisfies ChartConfig

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function ReportCharts({ costBreakdown, typeDistribution }: ReportChartsPropsT) {
  const costData = [
    {
      name: 'investmentExpenses',
      value: costBreakdown.investmentExpenses,
      fill: 'var(--color-investmentExpenses)',
    },
    {
      name: 'employeeExpenses',
      value: costBreakdown.employeeExpenses,
      fill: 'var(--color-employeeExpenses)',
    },
    { name: 'laborCosts', value: costBreakdown.laborCosts, fill: 'var(--color-laborCosts)' },
  ].filter((d) => d.value > 0)

  const filtered = typeDistribution.filter((d) => d.total > 0)

  const typeConfig: ChartConfig = Object.fromEntries(
    filtered.map((d, i) => [
      d.type,
      {
        label: TRANSFER_TYPE_LABELS[d.type as TransferTypeT] ?? d.type,
        color: CHART_COLORS[i % CHART_COLORS.length],
      },
    ]),
  )

  const typeData = filtered.map((d) => ({
    name: d.type,
    value: d.total,
    fill: `var(--color-${d.type})`,
  }))

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <PieChartCard title="Podział kosztów" data={costData} config={COST_CONFIG} />
      <PieChartCard title="Rozkład typów transakcji" data={typeData} config={typeConfig} />
    </div>
  )
}

type PieSliceT = { name: string; value: number; fill: string }

function PieChartCard({
  title,
  data,
  config,
}: {
  title: string
  data: PieSliceT[]
  config: ChartConfig
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Brak danych</p>
        ) : (
          <ChartContainer config={config} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" />
              <ChartTooltip
                content={<ChartTooltipContent nameKey="name" formatter={plnFormatter} />}
              />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function plnFormatter(value: unknown) {
  return formatPLN(Number(value))
}
