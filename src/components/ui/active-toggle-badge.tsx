'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
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
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        optimisticActive
          ? 'border border-green-600 text-green-600 hover:bg-green-600 hover:text-white'
          : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20',
        isPending && 'opacity-50',
      )}
    >
      {optimisticActive ? activeLabel : inactiveLabel}
    </button>
  )
}
