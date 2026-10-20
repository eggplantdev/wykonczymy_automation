import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export function WarningBanner({
  children,
  className,
  bordered = true,
}: {
  children: ReactNode
  className?: string
  bordered?: boolean
}) {
  return (
    <p
      role="alert"
      className={cn(
        'text-destructive flex items-start gap-2 text-xs font-semibold',
        bordered && 'rounded border-2 py-1.5',
        className,
      )}
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
