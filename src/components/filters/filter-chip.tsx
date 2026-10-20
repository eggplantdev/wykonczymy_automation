import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

type FilterChipPropsT = {
  label: string
  onRemove: () => void
  count?: number
  removeLabel: string
  className?: string
}

export function FilterChip({ label, onRemove, count, removeLabel, className }: FilterChipPropsT) {
  return (
    <Badge
      appearance="outline"
      shape="pill"
      onRemove={onRemove}
      removeLabel={removeLabel}
      className={cn(
        'border-input bg-background text-foreground max-w-full shrink-0 font-normal',
        className,
      )}
    >
      {/* Capped at the bar's width and ellipsised: a condition's label is a whole sentence („Tylko:
          pozycje ze stawką wykonawcy od ceny z materiałem"), which on a phone pushed the X — the
          only way to switch the filter off — past the right edge. */}
      {/* eslint-disable-next-line local/no-hand-rolled-ui -- truncation reveal of the ellipsised label */}
      <span className="truncate" title={label}>
        {label}
      </span>
      {count != null && (
        <span className="text-muted-foreground shrink-0 tabular-nums">({count})</span>
      )}
    </Badge>
  )
}
