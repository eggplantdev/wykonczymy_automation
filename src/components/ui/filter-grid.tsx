import { cn } from '@/lib/utils/cn'

type FilterGridPropsT = {
  children: React.ReactNode
  className?: string
}

export function FilterGrid({ children, className }: FilterGridPropsT) {
  return <div className={cn('flex flex-1 flex-wrap gap-2', className)}>{children}</div>
}
