'use client'

import { useEffect } from 'react'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { BILANS_LABEL } from '@/lib/export/header-fields'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { HeaderFieldT } from '@/types/export'

const EXPENSE_LABEL = 'Koszty robocizny'
const INCOME_LABEL = 'Wpłaty'

const PAYOUTS_LABEL = 'Wypłaty'

const FIXED_FIELD_COLORS: Record<string, string> = {
  [EXPENSE_LABEL]: 'border-chart-orange',
  [PAYOUTS_LABEL]: 'border-chart-pink',
  [INCOME_LABEL]: 'border-chart-green',
}

const CATEGORY_PALETTE = ['border-chart-blue', 'border-chart-teal', 'border-chart-purple']

const LABOR_LABELS = new Set([EXPENSE_LABEL, PAYOUTS_LABEL])

const ROW_LABELS = ['Koszty materiałowe', 'Robocizna']

type FinancialStatsPropsT = {
  readonly fields: readonly HeaderFieldT[]
}

export function FinancialStats({ fields }: FinancialStatsPropsT) {
  const toggle = useHeaderFieldsStore((s) => s.toggle)
  const reset = useHeaderFieldsStore((s) => s.reset)

  const defaultHiddenLabels = fields.filter((f) => f.defaultHidden).map((f) => f.label)

  // Clear stale toggle state from previous pages — the Zustand store
  // persists across SPA navigations, but the component's internal Set
  // starts fresh on mount, causing print/export to disagree with the UI.
  useEffect(() => {
    reset(defaultHiddenLabels.length > 0 ? defaultHiddenLabels : undefined)
  }, [reset, defaultHiddenLabels])

  const displayFields = fields.filter((f) => f.label !== BILANS_LABEL)

  // Palette index only increments for fields without fixed colors,
  // so dynamic categories get consecutive palette slots.
  let paletteIndex = 0
  const entries: StatEntryT[] = displayFields.map((field) => {
    const borderClassName =
      FIXED_FIELD_COLORS[field.label] ?? CATEGORY_PALETTE[paletteIndex++ % CATEGORY_PALETTE.length]

    return {
      label: field.label,
      value: field.value,
      amount: field.amount ?? 0,
      borderClassName,
      pairedWith: field.pairedWith,
      defaultHidden: field.defaultHidden,
    }
  })

  const incomeEntry = entries.find((e) => e.label === INCOME_LABEL)
  const laborRow = entries.filter((e) => LABOR_LABELS.has(e.label))
  const materialRow = entries.filter((e) => e.label !== INCOME_LABEL && !LABOR_LABELS.has(e.label))

  const rows = [materialRow, laborRow, ...(incomeEntry ? [[incomeEntry]] : [])]

  return (
    <ToggleStatButtons
      rows={rows}
      rowLabels={ROW_LABELS}
      summaryLabel="Bilans"
      onToggle={toggle}
      helpText="Saldo liczone jest dynamicznie jako suma wybranych kategorii kas oraz filtrów."
    />
  )
}
