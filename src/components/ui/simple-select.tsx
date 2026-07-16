'use client'

import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'

export type SelectOptionT = { value: string; label: ReactNode }
export type SelectVariantT = 'default' | 'soft' | 'pill'

// Complete trigger presets — each variant carries its whole look (height, radius, text, gap, width)
// so a call site picks a variant and needs no className. `soft`/`pill` are the compact toolbar
// controls that line up with CoeffField inputs (h-6, xs text); soft = 4px radius, pill = fully round.
const VARIANT: Record<SelectVariantT, { size: 'xs' | 'sm' | 'default'; className: string }> = {
  default: { size: 'default', className: '' },
  soft: { size: 'xs', className: 'w-fit gap-1 rounded text-xs' },
  pill: { size: 'xs', className: 'w-fit gap-1 rounded-full text-xs' },
}

type PropsT = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOptionT[]
  placeholder?: string
  disabled?: boolean
  variant?: SelectVariantT
  // Merged onto the trigger after the variant preset — call sites tune width/text here (e.g. "w-fit").
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
  variant = 'default',
  className,
}: PropsT) {
  const preset = VARIANT[variant]
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger size={preset.size} className={cn(preset.className, className)}>
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
