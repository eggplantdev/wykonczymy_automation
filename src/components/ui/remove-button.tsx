import { X } from 'lucide-react'
import { Button, type ButtonPropsT } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type RemoveButtonPropsT = {
  onClick: () => void
  disabled?: boolean
  variant?: ButtonPropsT['variant']
  className?: string
  'aria-label'?: string
}

export function RemoveButton({
  onClick,
  disabled,
  variant = 'ghostDestructive',
  className,
  'aria-label': ariaLabel = 'Usuń',
}: RemoveButtonPropsT) {
  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn('shrink-0', className)}
    >
      <X className="size-4" />
    </Button>
  )
}
