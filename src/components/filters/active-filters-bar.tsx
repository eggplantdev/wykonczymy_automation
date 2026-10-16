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
