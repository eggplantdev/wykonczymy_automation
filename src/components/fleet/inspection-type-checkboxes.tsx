'use client'

import { CheckboxRow } from '@/components/ui/checkbox-row'
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
        <CheckboxRow
          key={type}
          variant="plain"
          checked={selected.includes(type)}
          onCheckedChange={() =>
            onChange(
              selected.includes(type)
                ? selected.filter((candidate) => candidate !== type)
                : [...selected, type],
            )
          }
        >
          {INSPECTION_TYPE_LABELS[type].pl}
        </CheckboxRow>
      ))}
    </div>
  )
}
