'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { toggleCashRegisterActive } from '@/lib/actions/toggle-active'

export type CashRegisterRowT = {
  readonly id: number
  readonly name: string
  readonly ownerName: string
  readonly balance: number
  readonly type: 'MAIN' | 'AUXILIARY'
  readonly active: boolean
}

const col = createColumnHelper<CashRegisterRowT>()

export const cashRegisterColumns = [
  col.accessor('name', {
    id: 'name',
    header: 'Nazwa',
  }),
  col.accessor('ownerName', {
    id: 'ownerName',
    header: 'Właściciel',
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('balance', {
    id: 'balance',
    header: () => <span className="block text-right">Saldo</span>,
    cell: (info) => <span className="block font-medium">{formatPLN(info.getValue())}</span>,
  }),
  col.accessor('active', {
    id: 'active',
    header: 'Status',
    enableSorting: false,
    cell: (info) => (
      <ActiveToggleBadge
        id={info.row.original.id}
        isActive={info.getValue()}
        onToggle={toggleCashRegisterActive}
        activeLabel="Aktywna"
        inactiveLabel="Nieaktywna"
      />
    ),
  }),
]
