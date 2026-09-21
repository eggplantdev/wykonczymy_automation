import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type FilterTriggerButtonPropsT = Pick<
  React.ComponentProps<typeof Button>,
  'onClick' | 'title' | 'disabled' | 'type'
> & {
  active: boolean
  // What the filter is about, not what it does: „destructive" is for a trigger whose subject is
  // a defect (the kosztorys „Problemy"), so both of its states are red instead of the neutral
  // outline / green-active pair every ordinary filter wears.
  tone?: 'default' | 'destructive'
  icon?: LucideIcon
  children?: React.ReactNode
  className?: string
}

// For a trigger standing in a toolbar row rather than the filter grid: the 160px floor below is the
// grid's, and `min-w-0` alone cannot cancel it — tailwind-merge keeps a `sm:` variant beside an
// unprefixed class, and min-width beats `w-fit` anyway.
export const TOOLBAR_FILTER_TRIGGER_CLASS = 'w-fit sm:min-w-0'

// The same fit for a trigger that IS in the grid: only from `sm`, where ControlGrid stops being two
// even columns — shrinking a grid cell to its label is the ragged staircase that grid exists to stop.
export const GRID_FILTER_TRIGGER_CLASS = 'sm:w-fit sm:min-w-0'

export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonPropsT>(
  function FilterTriggerButton(
    { active, tone = 'default', icon: Icon, children, className, ...props },
    ref,
  ) {
    const variant =
      tone === 'destructive'
        ? active
          ? 'destructive'
          : 'outlineDestructive'
        : active
          ? 'activeFilter'
          : 'outline'

    return (
      <Button
        ref={ref}
        variant={variant}
        size="sm"
        align="start"
        // The label is clipped, not wrapped: Button is `whitespace-nowrap`, so a long one
        // („Typ wydatku inwestycyjnego") ran straight out of the grid cell on a phone.
        className={cn('overflow-hidden sm:min-w-40', className)}
        {...props}
      >
        {Icon && <Icon />}
        <span className="truncate">{children}</span>
      </Button>
    )
  },
)
