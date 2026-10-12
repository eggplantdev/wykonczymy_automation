'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Select,
  SelectButtonTrigger,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { cn } from '@/lib/utils/cn'

// `icon` renders inside the item's text node, which Radix mirrors into the trigger — so an option
// that carries one is recognisable both open and collapsed, without a second prop for the trigger.
export type SelectOptionT = {
  value: string
  label: ReactNode
  icon?: LucideIcon
  description?: ReactNode
  // Colour classes for the option's icon and name in the open list (the item's own rule mutes icons).
  tone?: string
  className?: string
}
export type SelectVariantT = 'default' | 'soft' | 'pill' | 'toolbar' | 'toolbarSm'

// Complete trigger presets — each variant carries its whole look (height, radius, text, gap, width)
// so a call site picks a variant and needs no className. `soft`/`pill` are the compact toolbar
// controls that line up with DecimalField inputs (h-6, xs text); soft = 4px radius, pill = fully round.
const VARIANT: Record<
  SelectVariantT,
  { size: 'xs' | 'sm' | 'default'; className: string; buttonTrigger?: true }
> = {
  default: { size: 'default', className: '' },
  soft: { size: 'xs', className: 'w-fit gap-1 rounded text-xs' },
  pill: { size: 'xs', className: 'w-fit gap-1 rounded-full text-xs' },
  // `buttonTrigger` swaps the trigger for the Button primitive, so the geometry is whatever the
  // toolbar buttons beside it have — hence the empty className.
  toolbar: { size: 'sm', className: '', buttonTrigger: true },
  // Same swap, shrunk down — the settings selects (settlement mode, materiały netto, rabat globalny)
  // sit inside a dense collapsible panel, not a full toolbar.
  toolbarSm: { size: 'sm', className: 'h-7 px-2 text-xs', buttonTrigger: true },
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
  invalid?: boolean
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
  invalid,
}: PropsT) {
  const preset = VARIANT[variant]
  const selected = options.find((option) => option.value === value)
  // Radix mirrors the whole item into the trigger; given children it shows those instead, so the
  // closed select carries the name without the description.
  const selectedValue = selected?.description ? (
    <>
      {selected.icon && <selected.icon />}
      {selected.label}
    </>
  ) : undefined
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      {preset.buttonTrigger ? (
        <SelectButtonTrigger aria-invalid={invalid} className={cn(preset.className, className)}>
          <SelectValue placeholder={placeholder}>{selectedValue}</SelectValue>
        </SelectButtonTrigger>
      ) : (
        <SelectTrigger
          size={preset.size}
          aria-invalid={invalid}
          className={cn(preset.className, className)}
        >
          <SelectValue placeholder={placeholder}>{selectedValue}</SelectValue>
        </SelectTrigger>
      )}
      {/* Descriptions wrap at the kosztorys menus' width instead of stretching the list to the longest. */}
      <SelectContent className={cn(options.some((option) => option.description) && 'w-80')}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className={cn(option.tone, option.className)}
          >
            {option.icon && <option.icon className={option.tone} />}
            {option.description ? (
              <MenuItemBody label={option.label} description={option.description} />
            ) : (
              option.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
