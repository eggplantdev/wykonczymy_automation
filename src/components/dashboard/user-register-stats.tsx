'use client'

import { formatPLN } from '@/lib/utils/format-currency'
import { useCurrentUser } from '@/hooks/use-current-user'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { CashRegisterRowT } from '@/types/table-rows'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'

type UserRegisterStatsPropsT = {
  cashRegisters: CashRegisterRowT[]
  showAllRegisters?: boolean
}

export function UserRegisterStats({ cashRegisters, showAllRegisters }: UserRegisterStatsPropsT) {
  const { id } = useCurrentUser()
  const userEntries: StatEntryT[] = cashRegisters
    .filter((cr) => cr.ownerId === id)
    .map((cr) => ({
      label: cr.name,
      value: formatPLN(cr.balance),
      amount: cr.balance,
      borderClassName: 'border-chart-turquoise',
    }))

  const totalRegisterBalance = showAllRegisters
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
      {totalRegisterBalance !== null && (
        <SignedMoneyDisplay
          amount={totalRegisterBalance}
          label="Saldo wszystkich kas (bez wirtualnych)"
        />
      )}
    </div>
  )
}
