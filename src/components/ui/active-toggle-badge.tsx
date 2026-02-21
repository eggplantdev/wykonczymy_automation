'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toastMessage } from '@/components/toasts'
import type { ActionResultT } from '@/lib/actions/utils'

type ActiveToggleBadgePropsT = {
  readonly id: number
  readonly isActive: boolean
  readonly onToggle: (id: number, newValue: boolean) => Promise<ActionResultT>
  readonly activeLabel?: string
  readonly inactiveLabel?: string
}

export function ActiveToggleBadge({
  id,
  isActive,
  onToggle,
  activeLabel = 'Aktywny',
  inactiveLabel = 'Nieaktywny',
}: ActiveToggleBadgePropsT) {
  const [optimisticActive, setOptimisticActive] = useState(isActive)
  const [isPending, setIsPending] = useState(false)

  const variant = isPending ? 'badgePending' : optimisticActive ? 'badgeActive' : 'badgeInactive'

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (isPending) return

    const newValue = !optimisticActive
    setOptimisticActive(newValue)
    setIsPending(true)

    try {
      const result = await onToggle(id, newValue)
      if (!result.success) {
        setOptimisticActive(!newValue)
        toastMessage(result.error, 'error')
      }
    } catch {
      setOptimisticActive(!newValue)
      toastMessage('Wystąpił błąd', 'error')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button variant={variant} size="badge" onClick={handleClick} disabled={isPending}>
      {optimisticActive ? activeLabel : inactiveLabel}
    </Button>
  )
}
