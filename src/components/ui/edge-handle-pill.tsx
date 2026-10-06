import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// The visible pill of a handle that sits astride a divider, so it reads as "this edge moves" rather
// than as one more control. The hover state keys off a `group` the caller puts on its own, wider hit
// area; `orientation` names the edge: a vertical pill rides a vertical divider.
export function EdgeHandlePill({
  orientation,
  children,
}: {
  orientation: 'vertical' | 'horizontal'
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'border-border bg-muted text-muted-foreground group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center rounded-full border transition-all',
        orientation === 'vertical' ? 'h-16 w-4 group-hover:h-24' : 'h-4 w-16 group-hover:w-24',
      )}
    >
      {children}
    </span>
  )
}
