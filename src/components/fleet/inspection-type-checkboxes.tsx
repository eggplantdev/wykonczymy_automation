'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { INSPECTION_TYPE_LABELS, type InspectionTypeT } from '@/lib/fleet/inspection-types'

export function InspectionTypeCheckboxes<T extends InspectionTypeT>({
  types,
  selected,
  onChange,
}: {
  types: readonly T[]
  selected: readonly T[]
  onChange: (next: T[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {types.map((type) => (
        <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={selected.includes(type)}
            onCheckedChange={() =>
              onChange(
                selected.includes(type)
                  ? selected.filter((candidate) => candidate !== type)
                  : [...selected, type],
              )
            }
          />
          {INSPECTION_TYPE_LABELS[type].pl}
        </label>
      ))}
    </div>
  )
}
