'use client'

import { useEffect } from 'react'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { BILANS_LABEL } from '@/lib/export/header-fields'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { HeaderFieldT } from '@/types/export'

const FIXED_FIELD_COLORS: Record<string, string> = {
  'Koszty robocizny': 'var(--color-chart-orange)',
  'Wpłaty od inwestora': 'var(--color-chart-green)',
}

const CATEGORY_PALETTE = [
  'var(--color-chart-blue)',
  'var(--color-chart-teal)',
  'var(--color-chart-purple)',
]

type FinancialStatsPropsT = {
  readonly fields: readonly HeaderFieldT[]
}

export function FinancialStats({ fields }: FinancialStatsPropsT) {
  const toggle = useHeaderFieldsStore((s) => s.toggle)
  const reset = useHeaderFieldsStore((s) => s.reset)

  useEffect(() => {
    if (Object.keys(useHeaderFieldsStore.getState().visibility).length > 0) {
      reset()
    }
  }, [reset])

  const displayFields = fields.filter((f) => f.label !== BILANS_LABEL)

  // Palette index only increments for fields without fixed colors,
  // so dynamic categories get consecutive palette slots.
  let paletteIndex = 0
  const entries: StatEntryT[] = displayFields.map((field) => {
    const borderColor =
      FIXED_FIELD_COLORS[field.label] ?? CATEGORY_PALETTE[paletteIndex++ % CATEGORY_PALETTE.length]

    return {
      label: field.label,
      value: field.value,
      amount: field.amount ?? 0,
      borderColor,
    }
  })

  return <ToggleStatButtons entries={entries} summaryLabel="Bilans" onToggle={toggle} />
}
