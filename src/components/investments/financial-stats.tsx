'use client'

import { useEffect } from 'react'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { BILANS_LABEL } from '@/lib/export/header-fields'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { HeaderFieldT } from '@/types/export'

const INCOME_LABEL = 'Wpłaty'
const LABOR_LABELS = new Set(['Koszty robocizny', 'Wypłaty'])

const MATERIAL_BORDER = 'border-chart-blue'
const LABOR_BORDER = 'border-chart-orange'
const INCOME_BORDER = 'border-chart-green'

const ROW_LABELS = ['Koszty materiałowe', 'Robocizna (wybierz jedną z dwóch opcji)']

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

  const toEntry = (field: HeaderFieldT, borderClassName: string): StatEntryT => ({
    label: field.label,
    value: field.value,
    amount: field.amount ?? 0,
    borderClassName,
    pairedWith: field.pairedWith,
    defaultHidden: field.defaultHidden,
  })

  const materialRow = displayFields
    .filter((f) => !LABOR_LABELS.has(f.label) && f.label !== INCOME_LABEL)
    .map((f) => toEntry(f, MATERIAL_BORDER))

  const laborRow = displayFields
    .filter((f) => LABOR_LABELS.has(f.label))
    .map((f) => toEntry(f, LABOR_BORDER))

  const incomeRow = displayFields
    .filter((f) => f.label === INCOME_LABEL)
    .map((f) => toEntry(f, INCOME_BORDER))

  const rows = [materialRow, laborRow, ...(incomeRow.length > 0 ? [incomeRow] : [])]

  return (
    <ToggleStatButtons
      rows={rows}
      rowLabels={ROW_LABELS}
      summaryLabel="Bilans"
      onToggle={toggle}
      helpText="Saldo liczone jest dynamicznie jako suma wybranych kategorii oraz filtrów."
    />
  )
}
