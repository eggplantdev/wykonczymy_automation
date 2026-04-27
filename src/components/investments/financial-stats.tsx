'use client'

import { useEffect } from 'react'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { FinancialFieldT } from '@/types/export'
import { SaldoDisplay } from '@/components/ui/saldo-display'
import { StatButton } from '@/components/ui/stat-button'
import { formatPLN } from '@/lib/format-currency'
import { calculateMargin } from '@/lib/calculate-margin'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'

const INCOME_LABEL = 'Wpłaty'
const CORRECTION_LABEL = 'Korekty'
const LABOR_LABEL = 'Robocizna'

type FinancialStatsPropsT = {
  fields: FinancialFieldT[]
  totalLaborCosts: number
  totalPayouts?: number
}

export function FinancialStats({
  fields,
  totalLaborCosts,
  totalPayouts = 0,
}: FinancialStatsPropsT) {
  const { role: userRole } = useCurrentUser()
  const toggle = useHeaderFieldsStore((s) => s.toggle)
  const reset = useHeaderFieldsStore((s) => s.reset)

  useEffect(() => {
    reset()
  }, [reset])

  const addBtnBorderColor = (field: FinancialFieldT, borderClassName: string): StatEntryT => ({
    ...field,
    borderClassName,
  })

  const expenseRow = fields
    .filter(
      (f) => f.label !== INCOME_LABEL && f.label !== CORRECTION_LABEL && f.label !== LABOR_LABEL,
    )
    .map((f) => addBtnBorderColor(f, 'border-chart-red'))

  const laborRow = fields
    .filter((f) => f.label === LABOR_LABEL)
    .map((f) => addBtnBorderColor(f, 'border-chart-orange'))

  const incomeRow = fields
    .filter((f) => f.label === INCOME_LABEL || f.label === CORRECTION_LABEL)
    .map((f) => addBtnBorderColor(f, 'border-chart-green'))

  const rows = [
    expenseRow,
    ...(laborRow.length > 0 ? [laborRow] : []),
    ...(incomeRow.length > 0 ? [incomeRow] : []),
  ]
  const margin = calculateMargin(totalLaborCosts, totalPayouts)

  return (
    <>
      <ToggleStatButtons
        rows={rows}
        rowLabels={['Koszty inwestora']}
        summaryLabel="Bilans inwestora"
        onToggle={toggle}
        helpText="Saldo liczone jest dynamicznie jako suma wybranych kategorii oraz filtrów."
      />

      {isAdminOrOwnerRole(userRole) && (
        <div className="text-muted-foreground mb-4 space-y-1 text-sm">
          <StatButton
            label="Wypłaty"
            value={formatPLN(totalPayouts)}
            className="border-chart-red"
          />
          <SaldoDisplay saldo={margin} label="Marża" />
        </div>
      )}
    </>
  )
}
