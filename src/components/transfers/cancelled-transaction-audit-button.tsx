'use client'

import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { useToggleSearchParam } from '@/hooks/use-toggle-search-param'

type CancelledTransactionAuditButtonPropsT = {
  baseUrl: string
}

export function CancelledTransactionAuditButton({
  baseUrl,
}: CancelledTransactionAuditButtonPropsT) {
  // Entering audit mode clears type + showCancelled (audit overrides them)
  const { isActive, setActive } = useToggleSearchParam(baseUrl, 'cancelledTransactionAudit', {
    clearOnEnable: ['type', 'showCancelled'],
  })

  return (
    <ActiveFilterButton
      isActive={isActive}
      onChange={setActive}
      activeLabel="Tryb anulowań"
      allLabel="Tryb anulowań"
    />
  )
}
