import { sectionColorFill } from '@/lib/kosztorys/section-colors'
import type { SectionSubtotalClientT } from '@/lib/kosztorys/types'

// section names / materiały labels are free-typed and can collide,
// so keying a Cell/legend row on `name` risks duplicate keys (mis-reconcile on the base toggle).
export type PieSliceT = { id: string; name: string; value: number; fill: string }

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

type RawSliceT = Omit<PieSliceT, 'fill'> & { fill?: string }

// Pinned slices are honoured as-is and their colours are REMOVED from the pool the unpinned ones
// draw from: without that, a section pinned to blue plus an unpinned one that lands on blue by
// position would render two identical wedges.
function paintSlices(raw: RawSliceT[]): PieSliceT[] {
  const kept = raw.filter((slice) => slice.value !== 0)
  const pinned = new Set(kept.map((slice) => slice.fill).filter((fill) => fill != null))
  const free = CHART_FILLS.filter((fill) => !pinned.has(fill))
  const pool = free.length > 0 ? free : CHART_FILLS
  let next = 0
  return kept.map((slice) => ({
    ...slice,
    fill: slice.fill ?? pool[next++ % pool.length],
  }))
}

export type SectionPieBaseT = 'planned' | 'executed'

export type SectionSliceInputT = Pick<
  SectionSubtotalClientT,
  'sectionId' | 'sectionName' | 'sectionColor' | 'plannedNet' | 'net'
>

export function sectionPieSlices(
  subtotals: readonly SectionSliceInputT[],
  base: SectionPieBaseT,
): PieSliceT[] {
  return paintSlices(
    subtotals.map((section) => ({
      id: `section-${section.sectionId}`,
      name: section.sectionName,
      value: base === 'planned' ? section.plannedNet : section.net,
      fill: sectionColorFill(section.sectionColor),
    })),
  )
}

export function costTotalsPieSlices(laborCostsNet: number, materialsBilled: number): PieSliceT[] {
  return paintSlices([
    { id: 'labor', name: 'Robocizna', value: laborCostsNet },
    { id: 'materials', name: 'Materiały', value: materialsBilled },
  ])
}
