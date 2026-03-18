'use client'

import { useMemo } from 'react'
import { formatPLN } from '@/lib/format-currency'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'

const USER_REGISTER_COLOR = 'var(--color-chart-turquoise)'

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
        borderColor: USER_REGISTER_COLOR,
        valueClassName:
          cr.balance > 0 ? 'text-chart-green' : cr.balance < 0 ? 'text-destructive' : undefined,
      }))
  }, [cashRegisters, currentUserName])

  if (userEntries.length === 0) return null

  return (
    <ToggleStatButtons
      rows={[userEntries]}
      summaryLabel="Saldo moich kas"
      rowLabels={['Moje Kasy']}
    />
  )
}
