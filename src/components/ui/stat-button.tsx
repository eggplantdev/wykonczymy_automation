import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type StatButtonPropsT = {
  label: string
  value: string
  className?: string
  tooltip?: string
  // Chart color token (e.g. 'chart-pink'). Colors border + value from one source so they stay in sync,
  // matching the transfers table's per-type amount coloring. Use instead of a border-* className.
  color?: string
}

export function StatButton({ label, value, className, tooltip, color }: StatButtonPropsT) {
  const colorVar = color ? `var(--color-${color})` : undefined
  // (i) sits beside the button, not inside — the button is disabled (no hover events) and nesting buttons is invalid.
  return (
    <span className="inline-flex items-center">
      <Button
        variant="outline"
        disabled
        className={cn('w-fit border-2', className)}
        style={colorVar ? { borderColor: colorVar } : undefined}
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold" style={colorVar ? { color: colorVar } : undefined}>
          {value}
        </span>
      </Button>
      {tooltip && <InfoTooltip content={tooltip} label={`Co to jest: ${label}`} className="ml-1" />}
    </span>
  )
}
