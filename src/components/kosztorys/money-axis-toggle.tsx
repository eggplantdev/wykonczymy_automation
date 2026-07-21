'use client'

import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'

// The client gets a plain three-way pick, not the editor's Widok dropdown — that one is a
// checkbox-pair surface wired to the editor context and carries the layer/etap axes too, none of
// which this view exposes. 'none' is deliberately absent: hiding every money column would leave the
// client staring at quantities with no prices.
const OPTIONS: OptionT<MoneyAxisT>[] = [
  { value: 'net', label: 'Netto' },
  { value: 'gross', label: 'Brutto' },
  { value: 'both', label: 'Pokaż wszystko' },
]

export function MoneyAxisToggle({
  value,
  onChange,
}: {
  value: MoneyAxisT
  onChange: (value: MoneyAxisT) => void
}) {
  return (
    <ToggleGroup
      options={OPTIONS}
      value={value}
      onChange={onChange}
      aria-label="Kwoty netto lub brutto"
    />
  )
}
