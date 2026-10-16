import { AlertTriangle } from 'lucide-react'
import { BADGE_BASE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

export function AlertBadge({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(BADGE_BASE, 'bg-destructive/10 text-destructive gap-1', className)}
      title={title}
    >
      <AlertTriangle className="size-3" />
      {children}
    </span>
  )
}
