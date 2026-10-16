'use client'

import { CheckIcon, ListFilter, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  keepMenuOpen,
} from '@/components/ui/dropdown-menu'
import { FilterTriggerButton } from '@/components/filters/filter-trigger-button'
import {
  INVESTMENT_STATUS_LABELS,
  INVESTMENT_STATUSES,
  type InvestmentStatusT,
} from '@/lib/constants/investment-status'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'

type StatusFilterPropsT = {
  selectedStatuses: Set<InvestmentStatusT>
  onToggle: (status: InvestmentStatusT) => void
  onClear: () => void
  triggerClassName?: string
}

export function StatusFilter({
  selectedStatuses,
  onToggle,
  onClear,
  triggerClassName,
}: StatusFilterPropsT) {
  const { t } = useTranslation('filters')
  // Nothing ticked lists every status.
  const isFiltered =
    selectedStatuses.size > 0 && selectedStatuses.size !== INVESTMENT_STATUSES.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTriggerButton
          active={isFiltered}
          icon={ListFilter}
          className={triggerClassName}
          title="Filtr statusu"
        >
          {`Status${isFiltered ? ` (${selectedStatuses.size})` : ''}`}
        </FilterTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Widoczne statusy</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {selectedStatuses.size > 0 && (
          <>
            <DropdownMenuItem onSelect={keepMenuOpen(onClear)}>
              <X />
              {t('clear')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {INVESTMENT_STATUSES.map((status) => (
          <DropdownMenuItem key={status} onSelect={keepMenuOpen(() => onToggle(status))}>
            <CheckIcon className={cn(!selectedStatuses.has(status) && 'opacity-0')} />
            {INVESTMENT_STATUS_LABELS[status].pl}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
