import { formatPercent } from '@/lib/kosztorys/format'

export type PieSliceT = { id: string; name: string; value: number; fill: string }

export function PieSliceLegend({
  slices,
  formatValue,
}: {
  slices: PieSliceT[]
  formatValue?: (value: number) => string
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  return (
    <ul className="flex w-full min-w-0 flex-col gap-1 text-sm">
      {slices.map((slice) => (
        <li key={slice.id} className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-xs" style={{ backgroundColor: slice.fill }} />
          <span className="min-w-0 truncate" title={slice.name}>
            {slice.name}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {total > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {formatPercent(slice.value / total)}
              </span>
            )}
            {formatValue && <span className="tabular-nums">{formatValue(slice.value)}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
