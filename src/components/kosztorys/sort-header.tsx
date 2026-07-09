'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { SortDirT } from '@/lib/kosztorys/v2-rows'

type PropsT = {
  label: string
  active: SortDirT | null
  onToggle: () => void
}

// Clickable sort header for react-datasheet-grid (title accepts a ReactNode).
// The asc → desc → none cycle is driven by the parent; here it's just render + event.
export function SortHeader({ label, active, onToggle }: PropsT) {
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ChevronsUpDown
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1 text-left font-medium"
    >
      <span className="truncate">{label}</span>
      <Icon className={cn('size-3 shrink-0', active ? 'opacity-100' : 'opacity-40')} />
    </button>
  )
}
