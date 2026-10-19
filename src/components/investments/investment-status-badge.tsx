import { Badge, type BadgeToneT } from '@/components/ui/badge'
import { INVESTMENT_STATUS_LABELS, type InvestmentStatusT } from '@/lib/constants/investment-status'

const STATUS_TONES: Record<InvestmentStatusT, BadgeToneT> = {
  planowana: 'sky',
  quote: 'pending',
  active: 'positive',
  completed: 'muted',
  rejected: 'negative',
}

// Optional lookup: a row whose status left the enum (the szablony, until their migration drops
// them) renders its raw value instead of taking the page down.
export function InvestmentStatusBadge({ status }: { status: InvestmentStatusT }) {
  return <Badge tone={STATUS_TONES[status]}>{INVESTMENT_STATUS_LABELS[status]?.pl ?? status}</Badge>
}
