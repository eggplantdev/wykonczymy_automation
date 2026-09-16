import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type FilterChipPropsT = {
  label: string
  onRemove: () => void
  // How many rows the thing this chip names is acting on, across the whole dataset. Omitted where
  // there is no such number to give (a search phrase acts on whatever it matches as you type).
  count?: number
  // Names the X for the reader of the tooltip, since the icon alone says „close" without saying what.
  removeLabel: string
  className?: string
}

/**
 * Only the X removes, never the chip body: a chip sits next to text people read and lean on to read
 * it, and a whole-chip click target turns „which filter was that again" into an accidental undo.
 *
 * Fully rounded and at badge type size so it reads as a peer of the pills already on screen rather
 * than a second, larger vocabulary of rounded things. Not built on `BADGE_BASE`: that one is
 * `rounded-md` with symmetric padding and leaves no room for an inline X.
 */
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
