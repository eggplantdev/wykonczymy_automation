import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type FilterTriggerButtonPropsT = {
  active: boolean
  icon?: LucideIcon
  children?: React.ReactNode
  className?: string
  title?: string
}

export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonPropsT>(
  function FilterTriggerButton({ active, icon: Icon, children, className, ...props }, ref) {
    return (
      <Button
        ref={ref}
        variant={active ? 'activeFilter' : 'outline'}
        size="sm"
        className={cn('min-w-40 justify-start', className)}
        {...props}
      >
        {Icon && <Icon className="size-4" />}
        {children}
      </Button>
    )
  },
)
