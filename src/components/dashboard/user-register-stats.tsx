'use client'

import { useMemo } from 'react'
import { formatPLN } from '@/lib/format-currency'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'

const USER_REGISTER_COLOR = 'border-chart-turquoise'

type UserRegisterStatsPropsT = {
  readonly cashRegisters: readonly CashRegisterRowT[]
  readonly currentUserName: string
}

export function UserRegisterStats({ cashRegisters, currentUserName }: UserRegisterStatsPropsT) {
  const userEntries: StatEntryT[] = useMemo(() => {
    return cashRegisters
      .filter((cr) => cr.ownerName === currentUserName)
      .map((cr) => ({
        label: cr.name,
        value: formatPLN(cr.balance),
        amount: cr.balance,
        borderClassName: USER_REGISTER_COLOR,
      }))
  }, [cashRegisters, currentUserName])

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
