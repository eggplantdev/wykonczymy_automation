import type { LucideIcon } from 'lucide-react'
import { Button, type ButtonPropsT } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

export type RowActionButtonPropsT = Omit<ButtonPropsT, 'variant' | 'size' | 'children'> & {
  icon: LucideIcon
  /** Accessible name and, unless `tooltip` overrides it, the tooltip — say what the action does on
   * THIS row, e.g. „Edytuj inwestycję". */
  label: string
  /** Overrides the tooltip only. For a disabled button, where the useful sentence is why. */
  tooltip?: string
  /** Prints `text` beside the icon. For a page header, where there is room and no row to crowd. */
  showLabel?: boolean
  /** What `showLabel` prints — the bare verb. `label` stays the accessible name, which says WHAT is
   * being edited; a header sits under the thing's name already, so printing it again reads twice. */
  text?: string
  tone?: 'neutral' | 'destructive'
}

// The one shape every per-row action takes, so „edytuj" and „usuń" cannot look like eight different
// buttons across eight tables. In a table row it is an icon with a tooltip — an action column holds
// two or three of these and a labelled button each time doubles the column's width; on a detail page
// header (`showLabel`) the same action prints its label, because there it is the page's main verb.
//
// A disabled button gets a focusable wrapper: Radix hangs the tooltip on the trigger's pointer
// events, and `disabled:pointer-events-none` means an explanation of WHY it is disabled would never
// appear — which is the one case where the tooltip matters most.
export function RowActionButton({
  icon: Icon,
  label,
  tooltip,
  showLabel = false,
  text,
  tone = 'neutral',
  className,
  disabled,
  ...props
}: RowActionButtonPropsT) {
  if (showLabel) {
    return (
      <Button
        size="sm"
        variant={tone === 'destructive' ? 'outlineDestructive' : 'outline'}
        className={className}
        disabled={disabled}
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
      variant={tone === 'destructive' ? 'ghostDestructive' : 'ghost'}
      className={cn('px-1.5', className)}
      aria-label={label}
      disabled={disabled}
      {...props}
    >
      <Icon />
    </Button>
  )

  return (
    <SimpleTooltip content={tooltip ?? label}>
      {disabled ? <span tabIndex={0}>{button}</span> : button}
    </SimpleTooltip>
  )
}
