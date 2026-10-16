import { X } from 'lucide-react'
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
    <span
      className={cn(
        'border-input bg-background text-foreground inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border py-0.5 pr-0.5 pl-2.5 text-xs whitespace-nowrap',
        className,
      )}
    >
      {/* Capped at the bar's width and ellipsised: a condition's label is a whole sentence („Tylko:
          pozycje ze stawką wykonawcy od ceny z materiałem"), which on a phone pushed the X — the
          only way to switch the filter off — past the right edge. */}
      <span className="truncate" title={label}>
        {label}
      </span>
      {count != null && (
        <span className="text-muted-foreground shrink-0 tabular-nums">({count})</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring/50 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <X className="size-3.5" />
      </button>
    </span>
  )
}
