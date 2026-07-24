'use client'

import { CheckIcon, ListFilter } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { STATUS_LABELS } from '@/components/investments/investment-status-badge'
import { cn } from '@/lib/utils/cn'
import type { InvestmentStatusT } from '@/types/reference-data'

const STATUS_ORDER: InvestmentStatusT[] = ['planowana', 'active', 'completed']

type StatusFilterPropsT = {
  selectedStatuses: Set<InvestmentStatusT>
  onToggle: (status: InvestmentStatusT) => void
}

export function StatusFilter({ selectedStatuses, onToggle }: StatusFilterPropsT) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label="Filtr statusu">
          <ListFilter />
          Status
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Widoczne statusy</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUS_ORDER.map((status) => (
          <DropdownMenuItem
            key={status}
            // Plain items + preventDefault, not DropdownMenuCheckboxItem: the menu must survive a
            // toggle so several statuses can be flipped in one visit.
            onSelect={(e) => e.preventDefault()}
            onClick={() => onToggle(status)}
          >
            <CheckIcon className={cn(!selectedStatuses.has(status) && 'opacity-0')} />
            {STATUS_LABELS[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
