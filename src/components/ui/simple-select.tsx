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

export type SelectOptionT = {
  value: string
  label: ReactNode
  icon?: LucideIcon
  description?: ReactNode
  tone?: string
  className?: string
}
export type SelectVariantT = 'default' | 'soft' | 'pill' | 'toolbar' | 'toolbarSm'

const VARIANT: Record<
  SelectVariantT,
  { size: 'xs' | 'sm' | 'default'; className: string; buttonTrigger?: true }
> = {
  default: { size: 'default', className: '' },
  soft: { size: 'xs', className: 'w-fit gap-1 rounded text-xs' },
  pill: { size: 'xs', className: 'w-fit gap-1 rounded-full text-xs' },
  toolbar: { size: 'sm', className: '', buttonTrigger: true },
  toolbarSm: { size: 'sm', className: 'h-7 px-2 text-xs', buttonTrigger: true },
}

type PropsT = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOptionT[]
  placeholder?: string
  disabled?: boolean
  variant?: SelectVariantT
  className?: string
  invalid?: boolean
}

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
