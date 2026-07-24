import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type DescriptionPropsT = {
  children: React.ReactNode
  className?: string
  withIcon?: boolean
}

export function Description({ children, className, withIcon = true }: DescriptionPropsT) {
  return (
    <p className={cn('text-muted-foreground flex items-start gap-1 text-sm', className)}>
      {withIcon && <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  )
}
