import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type StatButtonPropsT = {
  label: string
  value: string
  className?: string
  tooltip?: string
}

export function StatButton({ label, value, className, tooltip }: StatButtonPropsT) {
  // (i) sits beside the button, not inside — the button is disabled (no hover events) and nesting buttons is invalid.
  return (
    <span className="inline-flex items-center">
      <Button variant="outline" disabled className={cn('w-fit border-2', className)}>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </Button>
      {tooltip && <InfoTooltip content={tooltip} label={`Co to jest: ${label}`} className="ml-1" />}
    </span>
  )
}
