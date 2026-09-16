import { cn } from '@/lib/utils/cn'

/**
 * Two even columns below `sm`, a flex row above. Wrapping shrink-to-fit buttons on a phone left a
 * ragged staircase — each control as wide as its own label, breaking wherever the text happened to
 * run out. A grid gives every control the same width and one shared left edge; the labels then need
 * `justify-start`, or each would centre inside its own now-wider cell.
 *
 * The cell width is also why the 160px floor the filter triggers share (`FilterTriggerButton`) is
 * `sm:min-w-40` and not a bare one: in a two-column grid that floor needs a 360px viewport to the
 * pixel, so on anything narrower the row pushed the page sideways. Above `sm` there is no cell
 * setting the width, and the floor is back.
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
