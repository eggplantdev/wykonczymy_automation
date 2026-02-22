'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import type { CashRegisterTypeT } from '@/types/reference-data'

export type CashRegisterRowT = {
  readonly id: number
  readonly name: string
  readonly ownerName: string
  readonly balance: number
  readonly type: CashRegisterTypeT
  readonly active: boolean
}

const col = createColumnHelper<CashRegisterRowT>()

export function getCashRegisterColumns(onToggle: (id: number, newActive: boolean) => void) {
  return [
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
          onToggle={onToggle}
          activeLabel="Aktywna"
          inactiveLabel="Nieaktywna"
        />
      ),
    }),
  ]
}
