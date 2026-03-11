import { cn } from '@/lib/cn'

type DescriptionPropsT = {
  readonly children: React.ReactNode
  readonly className?: string
}

export function Description({ children, className }: DescriptionPropsT) {
  return <p className={cn('text-muted-foreground text-sm', className)}>{children}</p>
}
