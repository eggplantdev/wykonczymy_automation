import { BADGE_BASE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import type { InvestmentStatusT } from '@/types/reference-data'

export const STATUS_LABELS: Record<InvestmentStatusT, string> = {
  planowana: 'Planowana',
  active: 'Aktywna',
  completed: 'Zakończona',
  szablon: 'Szablon',
}

const STATUS_CLASSNAMES: Record<InvestmentStatusT, string> = {
  planowana: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  completed: 'bg-muted text-muted-foreground',
  szablon: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
}

export function InvestmentStatusBadge({ status }: { status: InvestmentStatusT }) {
  return <span className={cn(BADGE_BASE, STATUS_CLASSNAMES[status])}>{STATUS_LABELS[status]}</span>
}
