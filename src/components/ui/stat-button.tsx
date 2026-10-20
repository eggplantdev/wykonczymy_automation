import { cn } from '@/lib/utils/cn'
import { COLOR_TOKEN_CLASSES, type ColorTokenT } from '@/styles/color-tokens'
import { Button, type ButtonPropsT } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type StatButtonPropsT = {
  label: string
  value: string
  className?: string
  valueClassName?: string
  tooltip?: string
  color?: ColorTokenT
  onClick?: ButtonPropsT['onClick']
  align?: ButtonPropsT['align']
}

export function StatButton({
  label,
  value,
  className,
  valueClassName,
  tooltip,
  color,
  onClick,
  align,
}: StatButtonPropsT) {
  const colorClasses = color ? COLOR_TOKEN_CLASSES[color] : undefined
  const button = (
    <Button
      variant="outline"
      disabled={!onClick}
      onClick={onClick}
      align={align}
      className={cn('border-2', !onClick && 'w-fit', colorClasses?.border, className)}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', colorClasses?.text, valueClassName)}>{value}</span>
    </Button>
  )

  if (!tooltip) return button

  // (i) sits beside the button, not inside — a disabled button gets no hover events and nesting buttons is invalid.
  return (
    <span className="inline-flex items-center">
      {button}
      <InfoTooltip content={tooltip} label={`Co to jest: ${label}`} className="ml-1" />
    </span>
  )
}
