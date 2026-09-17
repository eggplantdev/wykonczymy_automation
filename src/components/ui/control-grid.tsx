import { cn } from '@/lib/utils/cn'

/**
 * Two even columns below `sm`, a flex row above — shrink-to-fit buttons wrapped into a ragged
 * staircase on a phone. `FilterTriggerButton`'s 160px floor is `sm:min-w-40`, not bare, because at
 * two columns it needs a 360px viewport or it pushes the page sideways.
 */
const CONTROL_GRID = 'grid w-full grid-cols-2 gap-2 max-sm:[&_button]:justify-start'

type ControlGridPropsT = {
  children: React.ReactNode
  className?: string
}

export function ControlGrid({ children, className }: ControlGridPropsT) {
  return (
    <div className={cn(CONTROL_GRID, 'sm:flex sm:flex-1 sm:flex-wrap', className)}>{children}</div>
  )
}
