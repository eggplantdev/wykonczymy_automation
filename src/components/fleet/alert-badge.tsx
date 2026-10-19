import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
    <Badge tone="destructive" className={cn('gap-1', className)} title={title}>
      <AlertTriangle className="size-3" />
      {children}
    </Badge>
  )
}
