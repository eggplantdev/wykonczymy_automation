import type { ReactNode } from 'react'
import { Checkbox, type CheckboxVariantT } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils/cn'

export function CheckboxRow({
  checked,
  onCheckedChange,
  disabled,
  variant,
  className,
  children,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  variant?: CheckboxVariantT | 'plain'
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 text-sm',
        variant !== 'plain' && 'hover:bg-accent rounded-md px-2 py-1.5',
        className,
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        variant={variant === 'plain' ? undefined : variant}
        onCheckedChange={(state) => onCheckedChange(state === true)}
      />
      {children}
    </label>
  )
}
