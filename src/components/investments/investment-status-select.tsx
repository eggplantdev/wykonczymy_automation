'use client'

import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import { BadgeSelect } from '@/components/ui/badge-select'
import { INVESTMENT_STATUSES, type InvestmentStatusT } from '@/lib/constants/investment-status'

const OPTIONS = INVESTMENT_STATUSES.map((status) => ({
  value: status,
  badge: <InvestmentStatusBadge status={status} />,
}))

type PropsT = {
  value: InvestmentStatusT
  onValueChange: (status: InvestmentStatusT) => void
  disabled?: boolean
  hideChevron?: boolean
}

export function InvestmentStatusSelect({ value, onValueChange, disabled, hideChevron }: PropsT) {
  return (
    <BadgeSelect
      value={value}
      options={OPTIONS}
      onValueChange={onValueChange}
      disabled={disabled}
      hideChevron={hideChevron}
    />
  )
}
