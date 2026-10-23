import { AlertIcon } from '@/components/ui/alert-icon'
import { Badge } from '@/components/ui/badge'
import { SimpleTooltip } from '@/components/ui/tooltip'
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
    <SimpleTooltip content={title}>
      <Badge tone="destructive" className={cn('gap-1', className)}>
        <AlertIcon className="size-3" />
        {children}
      </Badge>
    </SimpleTooltip>
  )
}
