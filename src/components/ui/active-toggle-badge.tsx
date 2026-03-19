'use client'

import { Button } from '@/components/ui/button'

type ActiveToggleBadgePropsT = {
  id: number
  isActive: boolean
  onToggle: (id: number, newValue: boolean) => void
  activeLabel?: string
  inactiveLabel?: string
}

export function ActiveToggleBadge({
  id,
  isActive,
  onToggle,
  activeLabel = 'Aktywny',
  inactiveLabel = 'Nieaktywny',
}: ActiveToggleBadgePropsT) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onToggle(id, !isActive)
  }

  return (
    <Button variant={isActive ? 'badgeActive' : 'badgeInactive'} size="badge" onClick={handleClick}>
      {isActive ? activeLabel : inactiveLabel}
    </Button>
  )
}
