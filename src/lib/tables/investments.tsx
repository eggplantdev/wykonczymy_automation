'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { toggleInvestmentStatus } from '@/lib/actions/toggle-active'

export type InvestmentRowT = {
  readonly id: number
  readonly name: string
  readonly status: 'active' | 'completed'
  readonly totalCosts: number
  readonly totalIncome: number
  readonly laborCosts: number
  readonly balance: number
  readonly address: string
  readonly phone: string
  readonly email: string
  readonly contactPerson: string
}

const col = createColumnHelper<InvestmentRowT>()

export const investmentColumns = [
  col.accessor('name', {
    id: 'name',
    header: 'Nazwa',
    meta: { canHide: false, label: 'Nazwa' },
  }),

  col.accessor('totalCosts', {
    id: 'totalCosts',
    header: () => <span className="block text-right">Koszty</span>,
    meta: { label: 'Koszty' },
    cell: (info) => (
      <span className="block text-right font-medium">{formatPLN(info.getValue())}</span>
    ),
  }),
  col.accessor('balance', {
    id: 'balance',
    header: () => <span className="block text-right">Bilans</span>,
    meta: { label: 'Bilans' },
    cell: (info) => (
      <span className="block text-right font-medium">{formatPLN(info.getValue())}</span>
    ),
  }),
  col.accessor('address', {
    id: 'address',
    header: 'Adres',
    meta: { label: 'Adres' },
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('phone', {
    id: 'phone',
    header: 'Telefon',
    meta: { label: 'Telefon' },
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('email', {
    id: 'email',
    header: 'Email',
    meta: { label: 'Email' },
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('contactPerson', {
    id: 'contactPerson',
    header: 'Osoba kontaktowa',
    meta: { label: 'Osoba kontaktowa' },
    cell: (info) => info.getValue() || '—',
  }),
  col.accessor('status', {
    id: 'status',
    header: 'Status',
    meta: { label: 'Status' },
    enableSorting: false,
    cell: (info) => (
      <ActiveToggleBadge
        id={info.row.original.id}
        isActive={info.getValue() === 'active'}
        onToggle={toggleInvestmentStatus}
        activeLabel="Aktywna"
        inactiveLabel="Zakończona"
      />
    ),
  }),
]
