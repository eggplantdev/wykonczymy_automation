import type { SectionSubtotalT } from '@/lib/kosztorys/types'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// `id` is a stable React key — section names / materiały labels are free-typed and can collide,
// so keying a Cell/legend row on `name` risks duplicate keys (mis-reconcile on the base toggle).
export type PieSliceT = { id: string; name: string; value: number; fill: string }

// Positional palette — order preserved from the old conic pie's SLICE_COLORS. recharts fills a slice
// with the raw CSS var; Tailwind never scans these, so no bg-chart-* utility is needed.
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

// Drop zero-value slices, then color the survivors by position — the shared tail of every pie
// builder. Coloring after the filter keeps the palette contiguous (no gaps where a zero was).
function paintSlices(raw: Omit<PieSliceT, 'fill'>[]): PieSliceT[] {
  return raw
    .filter((slice) => slice.value !== 0)
    .map((slice, index) => ({ ...slice, fill: fillAt(index) }))
}

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
  return paintSlices(
    subtotals.map((section) => ({
      id: `section-${section.sectionId}`,
      name: section.sectionName,
      value: base === 'przedmiar' ? section.plannedNet : section.net,
    })),
  )
}

// Two-slice cost split — robocizna vs materiały as single totals, no per-category breakdown. Used by
// the „Struktura kosztów" pie, which reasons in netto totals rather than the per-expense rozpiska.
export function costTotalsPieSlices(robocizna: number, materialy: number): PieSliceT[] {
  return paintSlices([
    { id: 'robocizna', name: 'Robocizna', value: robocizna },
    { id: 'materialy', name: 'Materiały', value: materialy },
  ])
}

// Per-category „Wydatki inwestycyjne" share — one slice per non-zero expense category. `row.net` is
// the brutto sum; the reduction is uniform, so brutto and netto proportions are identical.
export function expensePieSlices(rows: readonly MaterialyBreakdownRowT[]): PieSliceT[] {
  return paintSlices(
    rows.map((row) => ({
      id: row.id !== null ? `expense-${row.id}` : 'korekta',
      name: row.label,
      value: row.net,
    })),
  )
}

// Wpłaty split by VAT plane — netto vs brutto deposits. Shown only in tryb mieszany, where the plane
// distinction exists; the netto slice absorbs the unmarked deposits (they default to netto).
export function depositPlanePieSlices(paidNet: number, paidGross: number): PieSliceT[] {
  return paintSlices([
    { id: 'netto', name: 'Wpłaty netto', value: paidNet },
    { id: 'brutto', name: 'Wpłaty brutto', value: paidGross },
  ])
}
