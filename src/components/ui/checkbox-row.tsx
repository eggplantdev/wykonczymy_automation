import type { ReactNode } from 'react'
import { Checkbox, type CheckboxVariantT } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils/cn'

// The whole row is the hit target, which is why the label carries the padding and the hover — a
// bare `<Checkbox>` next to text gives a 16px one.
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
  variant?: CheckboxVariantT
  className?: string
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
        className,
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        variant={variant}
        onCheckedChange={(state) => onCheckedChange(state === true)}
      />
      {children}
    </label>
  )
}
