import {
  REGISTER_TYPE_BORDER_COLORS,
  REGISTER_TYPE_LABELS,
} from '@/components/tables/cash-registers'
import { formatPLN } from '@/lib/utils/format-currency'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { CashRegisterRowT } from '@/components/tables/cash-registers'
import type { CashRegisterTypeT } from '@/types/reference-data'

type RegisterBalanceChartPropsT = {
  data: CashRegisterRowT[]
}

export function RegisterBalanceChart({ data }: RegisterBalanceChartPropsT) {
  const groups = new Map<CashRegisterTypeT, { balance: number; count: number }>()
  for (const cr of data) {
    const prev = groups.get(cr.type) ?? { balance: 0, count: 0 }
    groups.set(cr.type, { balance: prev.balance + cr.balance, count: prev.count + 1 })
  }

  const entries: StatEntryT[] = Array.from(groups.entries()).map(([type, { balance, count }]) => ({
    label: `${REGISTER_TYPE_LABELS[type]} (${count})`,
    value: formatPLN(balance),
    amount: balance,
    borderClassName: REGISTER_TYPE_BORDER_COLORS[type],
  }))

  return (
    <ToggleStatButtons
      rows={[entries]}
      summaryLabel="Saldo"
      helpText="Saldo liczone jest dynamicznie jako suma wybranych typów kas oraz filtrów."
    />
  )
}
