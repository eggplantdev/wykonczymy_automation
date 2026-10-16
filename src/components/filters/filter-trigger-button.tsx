import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type FilterTriggerButtonPropsT = Pick<
  React.ComponentProps<typeof Button>,
  'onClick' | 'title' | 'disabled' | 'type'
> & {
  active: boolean
  tone?: 'default' | 'destructive'
  icon?: LucideIcon
  children?: React.ReactNode
  className?: string
}

// the 160px floor below is the grid's, and
// grid's, and `min-w-0` alone cannot cancel it — tailwind-merge keeps a `sm:` variant beside an
// unprefixed class, and min-width beats `w-fit` anyway.
export const TOOLBAR_FILTER_TRIGGER_CLASS = 'w-fit sm:min-w-0'

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
        className={cn('overflow-hidden sm:min-w-40', className)}
        {...props}
      >
        {Icon && <Icon />}
        <span className="truncate">{children}</span>
      </Button>
    )
  },
)
