'use client'

import { useEffect } from 'react'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { HeaderFieldT } from '@/types/export'

const INCOME_LABEL = 'Wpłaty'
const LABOR_LABELS = new Set(['Koszty robocizny', 'Wypłaty'])

const ROW_LABELS = ['Koszty materiałowe', 'Robocizna (wybierz jedną z dwóch opcji)', 'Dochód']

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

  const toEntry = (field: HeaderFieldT, borderClassName: string): StatEntryT => ({
    ...field,
    amount: field.amount ?? 0,
    borderClassName,
  })

  const materialRow = fields
    .filter((f) => !LABOR_LABELS.has(f.label) && f.label !== INCOME_LABEL)
    .map((f) => toEntry(f, 'border-chart-blue'))

  const laborRow = fields
    .filter((f) => LABOR_LABELS.has(f.label))
    .map((f) => toEntry(f, 'border-chart-orange'))

  const incomeRow = fields
    .filter((f) => f.label === INCOME_LABEL)
    .map((f) => toEntry(f, 'border-chart-green'))

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
