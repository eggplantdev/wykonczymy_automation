'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { BalanceCell } from '@/components/ui/balance-cell'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import type { CashRegisterTypeT } from '@/types/reference-data'

export type CashRegisterRowT = {
  id: number
  name: string
  ownerName: string
  balance: number
  type: CashRegisterTypeT
  active: boolean
}

export const REGISTER_TYPE_LABELS: Record<CashRegisterTypeT, string> = {
  MAIN: 'Główne',
  AUXILIARY: 'Pomocnicze',
  VIRTUAL: 'Wirtualne',
  WORKER: 'Pracownicze',
}

export const REGISTER_TYPE_LABELS_PLURAL: Record<CashRegisterTypeT, string> = {
  MAIN: 'Główne',
  AUXILIARY: 'Pomocnicze',
  VIRTUAL: 'Wirtualne - Telmak',
  WORKER: 'Pracownicze',
}

export const REGISTER_TYPE_BORDER_COLORS: Record<CashRegisterTypeT, string> = {
  MAIN: 'border-chart-blue',
  AUXILIARY: 'border-chart-teal',
  VIRTUAL: 'border-chart-purple',
  WORKER: 'border-chart-orange',
}

const col = createColumnHelper<CashRegisterRowT>()

export function getCashRegisterColumns(onToggle: (id: number, newActive: boolean) => void) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
    }),
    col.accessor('type', {
      id: 'type',
      header: 'Typ',
      cell: (info) => REGISTER_TYPE_LABELS[info.getValue()],
    }),
    col.accessor('ownerName', {
      id: 'ownerName',
      header: 'Właściciel',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('balance', {
      id: 'balance',
      header: 'Saldo',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    col.accessor('active', {
      id: 'active',
      header: 'Status',
      meta: { align: 'right' },
      enableSorting: true,
      cell: (info) => (
        <ActiveToggleBadge
          id={info.row.original.id}
          isActive={info.getValue()}
          onToggle={onToggle}
          activeLabel="Aktywna"
          inactiveLabel="Nieaktywna"
        />
      ),
    }),
  ]
}
