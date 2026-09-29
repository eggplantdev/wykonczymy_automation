import { BADGE_BASE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import {
  INVESTMENT_STATUSES,
  INVESTMENT_STATUS_LABELS,
  type InvestmentStatusT,
} from '@/lib/constants/investment-status'

export const STATUS_LABELS = Object.fromEntries(
  INVESTMENT_STATUSES.map((status) => [status, INVESTMENT_STATUS_LABELS[status].pl]),
) as Record<InvestmentStatusT, string>

const STATUS_CLASSNAMES: Record<InvestmentStatusT, string> = {
  planowana: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  quote: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  completed: 'bg-muted text-muted-foreground',
  szablon: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
}

export function InvestmentStatusBadge({ status }: { status: InvestmentStatusT }) {
  return <span className={cn(BADGE_BASE, STATUS_CLASSNAMES[status])}>{STATUS_LABELS[status]}</span>
}
