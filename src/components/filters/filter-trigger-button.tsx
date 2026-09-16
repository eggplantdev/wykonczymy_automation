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
  iconPosition?: 'left' | 'right'
  children?: React.ReactNode
  className?: string
}

export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonPropsT>(
  function FilterTriggerButton(
    { active, tone = 'default', icon: Icon, iconPosition = 'left', children, className, ...props },
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
        className={cn('sm:min-w-40', className)}
        {...props}
      >
        {Icon && iconPosition === 'left' && <Icon />}
        {children}
        {Icon && iconPosition === 'right' && <Icon />}
      </Button>
    )
  },
)
