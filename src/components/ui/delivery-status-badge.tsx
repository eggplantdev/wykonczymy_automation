import { cn } from '@/lib/cn'
import { BADGE_BASE } from '@/components/ui/badge'

export type DeliveryStatusT = 'pending' | 'sent' | 'failed' | 'skipped'

const STATUS: Record<DeliveryStatusT, { label: string; className: string }> = {
  pending: {
    label: 'Oczekuje',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  sent: {
    label: 'Wysłano',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  failed: { label: 'Błąd', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  skipped: { label: 'Pominięto', className: 'bg-muted text-muted-foreground' },
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatusT }) {
  const { label, className } = STATUS[status]
  return <span className={cn(BADGE_BASE, className)}>{label}</span>
}
