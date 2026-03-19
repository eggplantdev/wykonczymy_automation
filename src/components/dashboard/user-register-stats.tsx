'use client'

import { formatPLN } from '@/lib/format-currency'
import { useCurrentUser } from '@/hooks/use-current-user'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'

type UserRegisterStatsPropsT = {
  cashRegisters: CashRegisterRowT[]
}

export function UserRegisterStats({ cashRegisters }: UserRegisterStatsPropsT) {
  const { name } = useCurrentUser()
  const userEntries: StatEntryT[] = cashRegisters
    .filter((cr) => cr.ownerName === name)
    .map((cr) => ({
      label: cr.name,
      value: formatPLN(cr.balance),
      amount: cr.balance,
      borderClassName: 'border-chart-turquoise',
    }))

  if (userEntries.length === 0) return null

  return (
    <ToggleStatButtons
      rows={[userEntries]}
      summaryLabel="Saldo moich kas"
      rowLabels={['Moje Kasy']}
      colorValues
    />
  )
}
