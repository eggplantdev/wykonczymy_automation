'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'

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
]
