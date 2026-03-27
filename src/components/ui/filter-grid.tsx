import { cn } from '@/lib/cn'

type FilterGridPropsT = {
  children: React.ReactNode
  className?: string
}

export function FilterGrid({ children, className }: FilterGridPropsT) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {children}
    </div>
  )
}
