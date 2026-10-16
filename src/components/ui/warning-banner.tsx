import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export function WarningBanner({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      role="alert"
      className={cn(
        'text-destructive flex items-start gap-2 rounded border-2 py-1.5 text-xs font-semibold',
        className,
      )}
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
