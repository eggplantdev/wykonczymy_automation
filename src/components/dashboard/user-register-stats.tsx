'use client'

import { formatPLN } from '@/lib/format-currency'
import { useCurrentUser } from '@/hooks/use-current-user'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import { SaldoDisplay } from '@/components/ui/saldo-display'

type UserRegisterStatsPropsT = {
  cashRegisters: CashRegisterRowT[]
  showAllRegisters?: boolean
}

export function UserRegisterStats({ cashRegisters, showAllRegisters }: UserRegisterStatsPropsT) {
  const { name } = useCurrentUser()
  const userEntries: StatEntryT[] = cashRegisters
    .filter((cr) => cr.ownerName === name)
    .map((cr) => ({
      label: cr.name,
      value: formatPLN(cr.balance),
      amount: cr.balance,
      borderClassName: 'border-chart-turquoise',
    }))

  const totalSaldo = showAllRegisters
    ? cashRegisters.filter((cr) => cr.type !== 'VIRTUAL').reduce((sum, cr) => sum + cr.balance, 0)
    : null

  return (
    <div className="space-y-4">
      {userEntries.length > 0 && (
        <ToggleStatButtons
          rows={[userEntries]}
          summaryLabel="Saldo moich kas"
          rowLabels={['Moje Kasy']}
          colorValues
        />
      )}
      {totalSaldo !== null && (
        <SaldoDisplay saldo={totalSaldo} label="Saldo wszystkich kas (bez wirtualnych)" />
      )}
    </div>
  )
}
