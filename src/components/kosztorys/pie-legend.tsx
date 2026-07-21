import { formatNet, formatPercent } from '@/lib/kosztorys/format'
import type { PieSliceT } from '@/lib/kosztorys/chart-slices'

// Shared legend for both footer pies: swatch + name + share-of-total + net, matching the old conic
// SectionPie's list so the two charts read alike.
export function PieSliceLegend({ slices }: { slices: PieSliceT[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {slices.map((slice) => (
        <li key={slice.id} className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-xs" style={{ backgroundColor: slice.fill }} />
          <span className="truncate">{slice.name}</span>
          <span className="text-muted-foreground ml-auto pl-4 tabular-nums">
            {formatPercent(total > 0 ? slice.value / total : null)}
          </span>
          <span className="tabular-nums">{formatNet(slice.value)}</span>
        </li>
      ))}
    </ul>
  )
}
