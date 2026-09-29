'use client'

import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/filters/filter-chip'
import { cn } from '@/lib/utils/cn'

export type ActiveFiltersBarChipT = {
  id: string
  label: string
  count?: number
  removeLabel: string
}

type ActiveFiltersBarPropsT<ChipT extends ActiveFiltersBarChipT> = {
  chips: readonly ChipT[]
  onRemove: (chip: ChipT) => void
  onClearAll: () => void
  className?: string
}

/**
 * What is narrowing the list right now, on screen, each removable in one click.
 *
 * Absent when nothing is engaged, not rendered empty: a permanent strip is a line of chrome the eye
 * learns to skip, and its whole job is to be noticed the moment something is on.
 *
 * Wraps rather than scrolling sideways: a chip past the right edge is a filter the reader does not
 * know is on, which is the whole thing this bar exists to stop.
 */
export function ActiveFiltersBar<ChipT extends ActiveFiltersBarChipT>({
  chips,
  onRemove,
  onClearAll,
  className,
}: ActiveFiltersBarPropsT<ChipT>) {
  if (chips.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          count={chip.count}
          removeLabel={chip.removeLabel}
          onRemove={() => onRemove(chip)}
        />
      ))}
      {/* Last, and only worth offering beside two or more chips — with one on screen it would be a
          second button for what the X beside it already does. */}
      {chips.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-muted-foreground h-6 shrink-0 px-2 text-xs"
        >
          Wyczyść wszystko
        </Button>
      )}
    </div>
  )
}
