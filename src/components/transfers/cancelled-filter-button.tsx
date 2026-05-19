'use client'

import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { useToggleSearchParam } from '@/hooks/use-toggle-search-param'

type CancelledFilterButtonPropsT = {
  baseUrl: string
}

export function CancelledFilterButton({ baseUrl }: CancelledFilterButtonPropsT) {
  const { isActive: showCancelled, setActive: setShowCancelled } = useToggleSearchParam(
    baseUrl,
    'showCancelled',
  )

  return (
    <ActiveFilterButton
      isActive={!showCancelled}
      onChange={(hideCancelled) => setShowCancelled(!hideCancelled)}
      activeLabel="Anulowane ukryte"
      allLabel="Anulowane widoczne"
    />
  )
}
