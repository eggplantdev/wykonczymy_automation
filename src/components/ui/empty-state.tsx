import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type EmptyStatePropsT = {
  readonly title: string
  readonly description?: string
  readonly children?: ReactNode
  readonly className?: string
}

export function EmptyState({ title, description, children, className }: EmptyStatePropsT) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-4 p-8', className)}>
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      {children}
    </div>
  )
}
