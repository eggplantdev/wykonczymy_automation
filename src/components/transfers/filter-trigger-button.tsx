import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type FilterTriggerButtonPropsT = {
  active: boolean
  icon?: LucideIcon
  children: React.ReactNode
}

export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonPropsT>(
  function FilterTriggerButton({ active, icon: Icon, children, ...props }, ref) {
    return (
      <Button
        ref={ref}
        variant={active ? 'activeFilter' : 'outline'}
        size="sm"
        className="min-w-40 justify-start"
        {...props}
      >
        {Icon && <Icon className="size-4" />}
        {children}
      </Button>
    )
  },
)
