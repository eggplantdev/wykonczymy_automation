// 'use client'

// import { Pie, PieChart } from 'recharts'
// import {
//   ChartContainer,
//   ChartLegend,
//   ChartLegendContent,
//   ChartTooltip,
//   ChartTooltipContent,
// } from '@/components/ui/chart'
// import { formatPLN } from '@/lib/format-currency'
// import type { InvestmentFinancialsT } from '@/lib/db/sum-transfers'
// import type { ExpenseCategoryRefT } from '@/types/reference-data'

// const CATEGORY_FILLS = [
//   'var(--color-chart-red)',
//   'var(--color-chart-blue)',
//   'var(--color-chart-purple)',
//   'var(--color-chart-orange)',
//   'var(--color-chart-teal)',
// ] as const

// type ReportChartPropsT = {
//   readonly financials: InvestmentFinancialsT
//   readonly expenseCategories: readonly ExpenseCategoryRefT[]
// }

// export function ReportChart({ financials, expenseCategories }: ReportChartPropsT) {
//   const costMap = new Map(financials.categoryCosts.map((cc) => [cc.categoryId, cc.total]))

//   const categorySlices = expenseCategories.map((cat, i) => ({
//     name: cat.name,
//     value: costMap.get(cat.id) ?? 0,
//     fill: CATEGORY_FILLS[i % CATEGORY_FILLS.length],
//   }))

//   const data = [
//     ...categorySlices,
//     { name: 'Robocizna', value: financials.totalLaborCosts, fill: 'var(--color-chart-yellow)' },
//     { name: 'Wpłaty', value: financials.totalIncome, fill: 'var(--color-chart-green)' },
//   ]

//   if (data.length === 0) return <></>

//   return (
//     <ChartContainer className="mx-auto size-[300px]">
//       <PieChart>
//         <Pie data={data} dataKey="value" nameKey="name" />
//         <ChartTooltip content={<ChartTooltipContent valueFormatter={plnFormatter} />} />
//         <ChartLegend content={<ChartLegendContent />} />
//       </PieChart>
//     </ChartContainer>
//   )
// }

// function plnFormatter(value: unknown) {
//   return formatPLN(Number(value))
// }
