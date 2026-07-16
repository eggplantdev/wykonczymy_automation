'use client'

import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SelectOptionT = { value: string; label: ReactNode }

type PropsT = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOptionT[]
  placeholder?: string
  disabled?: boolean
  // Applied to the trigger — call sites size it here (e.g. "h-6 w-fit").
  className?: string
}

// Options-array shorthand for the common Select shape (trigger + value + mapped items). For
// form-bound selects use FormSelect; for in-grid cell pickers use CellSelectMenu.
export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
}: PropsT) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
