import { cn } from '@/lib/utils/cn'

type DescriptionPropsT = {
  children: React.ReactNode
  className?: string
}

export function Description({ children, className }: DescriptionPropsT) {
  return <p className={cn('text-muted-foreground text-sm', className)}>{children}</p>
}
