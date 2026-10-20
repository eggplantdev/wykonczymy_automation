import type { LucideIcon } from 'lucide-react'
import { Button, type ButtonPropsT } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'
import { useRowActionLabels } from './row-action-labels'

export type RowActionButtonPropsT = Omit<ButtonPropsT, 'variant' | 'size' | 'children'> & {
  icon: LucideIcon
  label: string
  tooltip?: string
  showLabel?: boolean
  text?: string
  tone?: 'neutral' | 'destructive'
}

// Disabled buttons get a focusable wrapper, since `disabled:pointer-events-none` would
// otherwise block Radix's tooltip trigger.
export function RowActionButton({
  icon: Icon,
  label,
  tooltip,
  showLabel = false,
  text,
  tone = 'neutral',
  className,
  disabled,
  pending,
  ...props
}: RowActionButtonPropsT) {
  const isLabelled = useRowActionLabels()
  const isOutlined = showLabel || isLabelled
  const variant =
    tone === 'destructive'
      ? isOutlined
        ? 'destructiveOutline'
        : 'ghostDestructive'
      : isOutlined
        ? 'outline'
        : 'ghost'

  if (showLabel) {
    return (
      <Button
        size="sm"
        variant={variant}
        className={className}
        disabled={disabled}
        pending={pending}
        aria-label={label}
        {...props}
      >
        <Icon />
        <span>{text ?? label}</span>
      </Button>
    )
  }

  const button = (
    <Button
      size="xs"
      variant={variant}
      className={cn(!isLabelled && 'px-1.5', className)}
      aria-label={label}
      disabled={disabled}
      pending={pending}
      {...props}
    >
      <Icon />
      {isLabelled && <span>{text ?? label}</span>}
    </Button>
  )

  return (
    <SimpleTooltip content={tooltip ?? label}>
      {disabled || pending ? <span tabIndex={0}>{button}</span> : button}
    </SimpleTooltip>
  )
}
