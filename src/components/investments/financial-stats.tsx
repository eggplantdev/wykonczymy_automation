'use client'

import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { FinancialFieldT } from '@/types/investment-financials'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import { StatButton } from '@/components/ui/stat-button'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { formatPLN } from '@/lib/utils/format-currency'
import { SETTLED_TYPE } from '@/lib/constants/transfers'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import {
  INCOME_LABEL,
  LABOR_LABEL,
  LOSS_LABEL,
  MATERIALS_DISCOUNT_LABEL,
  DISCOUNT_LABEL,
} from '@/lib/constants/financial-field-labels'

const CREDIT_LABELS: string[] = [INCOME_LABEL, DISCOUNT_LABEL, MATERIALS_DISCOUNT_LABEL, LOSS_LABEL]

const RESTRICTED_NOTE = '\nWidoczność — właściciel'
const TOOLTIPS = {
  investorCosts:
    'Materiały kupione na inwestycję, w podziale na kategorie. ' +
    'Zawierają korekty — korekta obniża koszt. Obniżają bilans inwestora.',
  laborCosts:
    'Kwota, którą inwestor płaci firmie za pracę. ' +
    'Obniża bilans inwestora i jest podstawą marży.',
  deposits: 'Wpłaty inwestora, finansowanie firmy i inne wpłaty. Podnoszą bilans inwestora.',
  discount:
    'Rabat na robociznę — obniża dług inwestora, więc podnosi jego bilans. ' +
    'Jednocześnie obniża marżę firmy.',
  materialsDiscount:
    'Wydatki rozliczane po kwocie netto — inwestor zwraca mniej, niż firma wydała. ' +
    'Podnosi bilans inwestora i obniża marżę firmy.',
  payouts:
    'Kwoty wypłacone pracownikom. Obniżają marżę. Nie wchodzą do bilansu inwestora.' +
    RESTRICTED_NOTE,
  loss:
    'Koszt, którego firma nie przerzuciła na inwestora — obniża jego dług, więc podnosi bilans ' +
    'inwestora. Jednocześnie obniża marżę firmy.',
  settledMaterials:
    'Materiały kupione przez firmę, wliczone w robociznę. ' +
    'Obniżają marżę, ale nie obciążają bilansu inwestora.',
  balance:
    'Bilans inwestora = Wpłaty − Materiały − Robocizna + Rabat + obniżka materiałów + Strata.\n' +
    'Jeśli minus — inwestor wisi pieniądze.\n' +
    'Dynamiczny: odznaczenie kafelka usuwa go z wyliczenia.',
  margin:
    'Marża = Robocizna − Wypłaty − Rabat − Strata − materiały wliczone w robociznę − obniżka materiałów.\n' +
    'Ile firma zarabia na inwestycji.' +
    RESTRICTED_NOTE,
} as const

const CREDIT_TOOLTIPS: Record<string, string> = {
  [DISCOUNT_LABEL]: TOOLTIPS.discount,
  [MATERIALS_DISCOUNT_LABEL]: TOOLTIPS.materialsDiscount,
  [LOSS_LABEL]: TOOLTIPS.loss,
}

type FinancialStatsPropsT = {
  fields: FinancialFieldT[]
  margin: number
  totalPayouts?: number
  settledFields?: FinancialFieldT[]
}

export function FinancialStats({
  fields,
  margin,
  totalPayouts = 0,
  settledFields = [],
}: FinancialStatsPropsT) {
  const { role: userRole } = useCurrentUser()

  const addBtnBorderColor = (field: FinancialFieldT, borderClassName: string): StatEntryT => ({
    ...field,
    borderClassName,
  })

  const expenseRow = fields
    .filter((f) => f.label !== LABOR_LABEL && !CREDIT_LABELS.includes(f.label))
    .map((f) => addBtnBorderColor(f, 'border-chart-red'))

  const laborRow = fields
    .filter((f) => f.label === LABOR_LABEL)
    .map((f) => ({ ...addBtnBorderColor(f, 'border-chart-orange'), tooltip: TOOLTIPS.laborCosts }))

  const incomeRow = fields
    .filter((f) => CREDIT_LABELS.includes(f.label))
    .map((f) => ({
      ...addBtnBorderColor(f, 'border-chart-green'),
      tooltip: CREDIT_TOOLTIPS[f.label] ?? TOOLTIPS.deposits,
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
        rowTooltips={[TOOLTIPS.investorCosts]}
        summaryLabel="Bilans inwestora"
        summaryTooltip={TOOLTIPS.balance}
      />

      {settledFields.length > 0 && (
        <div className="text-muted-foreground space-y-1 text-sm">
          <Description>
            {SETTLED_TYPE.label}
            <InfoTooltip
              content={TOOLTIPS.settledMaterials}
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
            tooltip={TOOLTIPS.payouts}
          />
          <SignedMoneyDisplay amount={margin} label="Marża" tooltip={TOOLTIPS.margin} />
        </div>
      )}
    </div>
  )
}
