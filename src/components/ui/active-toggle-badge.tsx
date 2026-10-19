'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type ActiveToggleBadgePropsT = {
  id: number
  isActive: boolean
  onToggle?: (id: number, newValue: boolean) => void
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
  const variant = isActive ? 'badgeActive' : 'badgeInactive'
  const label = isActive ? activeLabel : inactiveLabel

  if (!onToggle) {
    return (
      <span className={cn(buttonVariants({ variant, size: 'badge' }), 'pointer-events-none')}>
        {label}
      </span>
    )
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onToggle?.(id, !isActive)
  }

  return (
    <Button variant={variant} size="badge" onClick={handleClick}>
      {label}
    </Button>
  )
}
