'use client'

import { useEffect } from 'react'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { FinancialFieldT } from '@/types/export'
import { SaldoDisplay } from '@/components/ui/saldo-display'
import { StatButton } from '@/components/ui/stat-button'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { formatPLN } from '@/lib/format-currency'
import { SETTLED_TYPE } from '@/lib/constants/transfers'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'

const INCOME_LABEL = 'Wpłaty'
const LABOR_LABEL = 'Robocizna'
const RABAT_LABEL = 'Rabat'

// Both figures render only inside the isAdminOrOwnerRole(...) block below, so this
// note is shown exclusively to Admin/Owner — flags the figure as owner-level.
const RESTRICTED_NOTE = '\nWidoczność — właściciel'
const TOOLTIPS = {
  kosztyInwestora:
    'Materiały kupione na inwestycję, w podziale na kategorie. ' +
    'Zawierają korekty — korekta obniża koszt. Obniżają bilans inwestora.',
  robocizna:
    'Kwota, którą inwestor płaci firmie za pracę. ' +
    'Obniża bilans inwestora i jest podstawą marży.',
  wplaty: 'Wpłaty inwestora, finansowanie firmy i inne wpłaty. Podnoszą bilans inwestora.',
  rabat:
    'Rabat na robociznę — obniża dług klienta, więc podnosi bilans inwestora. ' +
    'Jednocześnie obniża marżę firmy.',
  wyplaty:
    'Kwoty wypłacone pracownikom. Obniżają marżę. Nie wchodzą do bilansu inwestora.' +
    RESTRICTED_NOTE,
  strata: 'Koszt pokrywany przez firmę. Obniża marżę. Nie wchodzi do bilansu inwestora.',
  materialyWliczone:
    'Materiały kupione przez firmę, wliczone w robociznę. ' +
    'Obniżają marżę, ale nie obciążają bilansu inwestora.',
  bilans:
    'Bilans inwestora = Wpłaty − Materiały − Robocizna + Rabat.\n' +
    'Jeśli minus — inwestor wisi pieniądze.\n' +
    'Dynamiczny: odznaczenie kafelka usuwa go z wyliczenia i z wydruku.',
  marza:
    'Marża = Robocizna − Wypłaty − Rabat − Strata − materiały wliczone w robociznę.\n' +
    'Ile firma zarabia na inwestycji.' +
    RESTRICTED_NOTE,
} as const

type FinancialStatsPropsT = {
  fields: FinancialFieldT[]
  // Margin is computed server-side via calculateMargin(financials) and passed in — the
  // component does not re-derive it, so listing and detail can't drift on marża.
  margin: number
  totalPayouts?: number
  totalLoss?: number
  settledFields?: FinancialFieldT[]
}

export function FinancialStats({
  fields,
  margin,
  totalPayouts = 0,
  totalLoss = 0,
  settledFields = [],
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
    .filter((f) => f.label !== INCOME_LABEL && f.label !== LABOR_LABEL && f.label !== RABAT_LABEL)
    .map((f) => addBtnBorderColor(f, 'border-chart-red'))

  const laborRow = fields
    .filter((f) => f.label === LABOR_LABEL)
    .map((f) => ({ ...addBtnBorderColor(f, 'border-chart-orange'), tooltip: TOOLTIPS.robocizna }))

  const incomeRow = fields
    .filter((f) => f.label === INCOME_LABEL || f.label === RABAT_LABEL)
    .map((f) => ({
      ...addBtnBorderColor(f, 'border-chart-green'),
      tooltip: f.label === RABAT_LABEL ? TOOLTIPS.rabat : TOOLTIPS.wplaty,
    }))

  const rows = [
    expenseRow,
    ...(laborRow.length > 0 ? [laborRow] : []),
    ...(incomeRow.length > 0 ? [incomeRow] : []),
  ]

  return (
    <div className="space-y-2">
      <ToggleStatButtons
        rows={rows}
        rowLabels={['Koszty inwestora']}
        rowTooltips={[TOOLTIPS.kosztyInwestora]}
        summaryLabel="Bilans inwestora"
        onToggle={toggle}
        summaryTooltip={TOOLTIPS.bilans}
      />

      {totalLoss !== 0 && (
        <div className="text-muted-foreground space-y-1 text-sm">
          <StatButton
            label="Strata"
            value={formatPLN(totalLoss)}
            className="border-chart-purple"
            tooltip={TOOLTIPS.strata}
          />
        </div>
      )}

      {settledFields.length > 0 && (
        <div className="text-muted-foreground space-y-1 text-sm">
          <Description>
            {SETTLED_TYPE.label}
            <InfoTooltip
              content={TOOLTIPS.materialyWliczone}
              label={`Co to jest: ${SETTLED_TYPE.label}`}
              className="ml-1"
            />
          </Description>
          {settledFields.map((f) => (
            <StatButton key={f.label} label={f.label} value={f.value} color={SETTLED_TYPE.color} />
          ))}
        </div>
      )}

      {isAdminOrOwnerRole(userRole) && (
        <div className="text-muted-foreground space-y-1 text-sm">
          <StatButton
            label="Wypłaty"
            value={formatPLN(totalPayouts)}
            className="border-chart-red"
            tooltip={TOOLTIPS.wyplaty}
          />
          <SaldoDisplay saldo={margin} label="Marża" tooltip={TOOLTIPS.marza} />
        </div>
      )}
    </div>
  )
}
