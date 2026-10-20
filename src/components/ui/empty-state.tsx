import type { ReactNode } from 'react'
import { SECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { cn } from '@/lib/utils/cn'

type EmptyStatePropsT = {
  title: string
  description?: string
  children?: ReactNode
  className?: string
  size?: 'page' | 'inline'
}

export function EmptyState({
  title,
  description,
  children,
  className,
  size = 'page',
}: EmptyStatePropsT) {
  if (size === 'inline') {
    return (
      <div
        className={cn(
          'text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm',
          className,
        )}
      >
        <p className="text-center">{title}</p>
        {description && <p className="text-center text-xs">{description}</p>}
        {children}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-4 p-8', className)}>
      <h2 className={cn('text-foreground', SECTION_TITLE_CLASS)}>{title}</h2>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      {children}
    </div>
  )
}
