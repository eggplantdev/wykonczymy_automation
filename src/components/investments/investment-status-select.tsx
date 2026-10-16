'use client'

import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { INVESTMENT_STATUSES, type InvestmentStatusT } from '@/lib/constants/investment-status'

const isInvestmentStatus = (value: string): value is InvestmentStatusT =>
  (INVESTMENT_STATUSES as readonly string[]).includes(value)

type PropsT = {
  value: InvestmentStatusT
  onValueChange: (status: InvestmentStatusT) => void
  disabled?: boolean
}

export function InvestmentStatusSelect({ value, onValueChange, disabled }: PropsT) {
  return (
    <Select
      value={value}
      onValueChange={(next) => isInvestmentStatus(next) && onValueChange(next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-fit border-0 bg-transparent px-0 shadow-none data-[size=default]:h-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {INVESTMENT_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            <InvestmentStatusBadge status={status} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
