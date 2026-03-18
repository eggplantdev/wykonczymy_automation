'use client'

import { useEffect } from 'react'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { ToggleStatButtons, computeSummary } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { HeaderFieldT } from '@/types/export'
import { SaldoDisplay } from '@/components/ui/saldo-display'

const INCOME_LABEL = 'Wpłaty'

type FinancialStatsPropsT = {
  readonly fields: readonly HeaderFieldT[]
  readonly totalPayouts?: number
}

export function FinancialStats({ fields, totalPayouts }: FinancialStatsPropsT) {
  const toggle = useHeaderFieldsStore((s) => s.toggle)
  const reset = useHeaderFieldsStore((s) => s.reset)
  const visibility = useHeaderFieldsStore((s) => s.visibility)

  useEffect(() => {
    reset()
  }, [reset])

  const toEntry = (field: HeaderFieldT, borderClassName: string): StatEntryT => ({
    ...field,
    amount: field.amount ?? 0,
    borderClassName,
  })

  const expenseRow = fields
    .filter((f) => f.label !== INCOME_LABEL)
    .map((f) => toEntry(f, 'border-chart-blue'))

  const incomeRow = fields
    .filter((f) => f.label === INCOME_LABEL)
    .map((f) => toEntry(f, 'border-chart-green'))

  const rows = [expenseRow, ...(incomeRow.length > 0 ? [incomeRow] : [])]
  const allEntries = rows.flat()

  // Compute current Bilans from visibility state (mirrors ToggleStatButtons internal logic)
  const hidden = new Set(
    allEntries.filter((e) => visibility[e.label] === false).map((e) => e.label),
  )
  const bilans = computeSummary(allEntries, hidden)
  const marza = bilans - (totalPayouts ?? 0)

  return (
    <>
      <ToggleStatButtons
        rows={rows}
        summaryLabel="Bilans"
        onToggle={toggle}
        helpText="Saldo liczone jest dynamicznie jako suma wybranych kategorii oraz filtrów."
      />

      {totalPayouts !== undefined && (
        <div className="mb-4 space-y-1">
          <SaldoDisplay saldo={-totalPayouts} label="Wypłaty" />
          <SaldoDisplay saldo={marza} label="Marża" />
        </div>
      )}
    </>
  )
}
