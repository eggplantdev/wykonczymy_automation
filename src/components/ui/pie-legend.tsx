import { formatPercentPrecise } from '@/lib/kosztorys/format'

export type PieSliceT = { id: string; name: string; value: number; fill: string }

// Shared legend for the footer pies. `formatValue` renders each slice's figure (the caller owns
// units/locale) and is optional — a pie whose slices are only comparable as shares leaves it out and
// shows the percent alone. Percent is a share of the slice total, so it stays internal with a
// generic default the caller can override.
export function PieSliceLegend({
  slices,
  formatValue,
  formatPercent = formatPercentPrecise,
}: {
  slices: PieSliceT[]
  formatValue?: (value: number) => string
  formatPercent?: (fraction: number | null) => string
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  return (
    <ul className="flex w-full min-w-0 flex-col gap-1 text-sm">
      {slices.map((slice) => (
        <li key={slice.id} className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-xs" style={{ backgroundColor: slice.fill }} />
          {/* The figures keep their width and the name gives up its tail: a sekcja is named in a full
              sentence („Instalacja wodno-kanalizacyjna / C.O."), and on a phone the row is narrower
              than that name plus its two numbers. The full name stays reachable as the tooltip. */}
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
