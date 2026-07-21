import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'

export type PieSliceT = { name: string; value: number; fill: string }

// Positional palette — order preserved from the old SLICE_COLORS (client/section-pie.tsx). recharts
// fills a slice with the raw CSS var; Tailwind never scans these, so no bg-chart-* utility is needed.
export const CHART_FILLS = [
  'var(--color-chart-blue)',
  'var(--color-chart-orange)',
  'var(--color-chart-green)',
  'var(--color-chart-purple)',
  'var(--color-chart-turquoise)',
  'var(--color-chart-pink)',
  'var(--color-chart-yellow)',
  'var(--color-chart-red)',
  'var(--color-chart-teal)',
] as const

const fillAt = (index: number) => CHART_FILLS[index % CHART_FILLS.length]

export type SectionPieBaseT = 'przedmiar' | 'wykonane'

// The section pie only needs each section's two money figures; it takes the client-priced,
// view-invariant subtotals so a structure chart never moves with the widok cen.
export type SectionSliceInputT = Pick<
  SectionSubtotalT,
  'sectionId' | 'sectionName' | 'plannedNet' | 'net'
>

export function sectionPieSlices(
  subtotals: readonly SectionSliceInputT[],
  base: SectionPieBaseT,
): PieSliceT[] {
  return subtotals.map((section, index) => ({
    name: section.sectionName,
    value: base === 'przedmiar' ? section.plannedNet : section.net,
    fill: fillAt(index),
  }))
}

export function costPieSlices(
  sumaPracNet: number,
  materialyBreakdown: readonly MaterialyBreakdownRowT[],
): PieSliceT[] {
  const rows: { name: string; value: number }[] = [
    { name: 'Robocizna', value: sumaPracNet },
    ...materialyBreakdown
      .filter((item) => item.net !== 0)
      .map((item) => ({ name: item.label, value: item.net })),
  ]
  return rows.map((row, index) => ({ ...row, fill: fillAt(index) }))
}
