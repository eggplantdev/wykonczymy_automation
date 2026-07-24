export type PieSliceT = { id: string; name: string; value: number; fill: string }

const defaultFormatPercent = (fraction: number | null) =>
  fraction === null
    ? '—'
    : fraction.toLocaleString('pl-PL', { style: 'percent', maximumFractionDigits: 0 })

// Shared legend for the footer pies. `formatValue` renders each slice's figure (the caller owns
// units/locale); percent is a share of the slice total, so it stays internal with a generic default
// the caller can override.
export function PieSliceLegend({
  slices,
  formatValue,
  formatPercent = defaultFormatPercent,
}: {
  slices: PieSliceT[]
  formatValue: (value: number) => string
  formatPercent?: (fraction: number | null) => string
}) {
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
          <span className="tabular-nums">{formatValue(slice.value)}</span>
        </li>
      ))}
    </ul>
  )
}
