'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { SortDirT } from '@/lib/kosztorys/v2-rows'

type PropsT = {
  label: string
  active: SortDirT | null
  onToggle: () => void
}

// Klikalny nagłówek sortujący dla react-datasheet-grid (title przyjmuje ReactNode).
// Cykl asc → desc → brak prowadzi rodzic; tu tylko render + zdarzenie.
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
