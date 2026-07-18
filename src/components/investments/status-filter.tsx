'use client'

import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import type { StatusViewT } from '@/hooks/use-status-filter'

const OPTIONS: OptionT<StatusViewT>[] = [
  { value: 'open', label: 'W toku' },
  { value: 'planowana', label: 'Planowane' },
  { value: 'active', label: 'Aktywne' },
  { value: 'completed', label: 'Zakończone' },
  { value: 'all', label: 'Wszystkie' },
]

type StatusFilterPropsT = {
  value: StatusViewT
  onChange: (value: StatusViewT) => void
}

export function StatusFilter({ value, onChange }: StatusFilterPropsT) {
  return (
    <ToggleGroup options={OPTIONS} value={value} onChange={onChange} aria-label="Filtr statusu" />
  )
}
