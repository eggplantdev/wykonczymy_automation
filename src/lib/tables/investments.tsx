'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { BalanceCell } from '@/components/ui/balance-cell'
import { ActiveToggleBadge } from '@/components/ui/active-toggle-badge'
import { MailtoLink } from '@/components/ui/mailto-link'

export type InvestmentRowT = {
  readonly id: number
  readonly name: string
  readonly status: 'active' | 'completed'
  readonly totalMaterialCosts: number
  readonly totalIncome: number
  readonly totalLaborCosts: number
  readonly balance: number
  readonly address: string
  readonly phone: string
  readonly email: string
  readonly contactPerson: string
}

const col = createColumnHelper<InvestmentRowT>()

export function getInvestmentColumns(onToggle: (id: number, newActive: boolean) => void) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      meta: { canHide: false },
    }),

    col.accessor('totalMaterialCosts', {
      id: 'totalMaterialCosts',
      header: 'Koszty',
      meta: { align: 'right' },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
    col.accessor('balance', {
      id: 'balance',
      header: 'Bilans',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    col.accessor('address', {
      id: 'address',
      header: 'Adres',

      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('phone', {
      id: 'phone',
      header: 'Telefon',

      cell: (info) => {
        const value = info.getValue()
        return value ? (
          <a href={`tel:${value}`} className="text-primary hover:underline">
            {value}
          </a>
        ) : (
          '—'
        )
      },
    }),
    col.accessor('email', {
      id: 'email',
      header: 'Email',

      cell: (info) => {
        const value = info.getValue()
        return value ? <MailtoLink email={value} /> : '—'
      },
    }),
    col.accessor('contactPerson', {
      id: 'contactPerson',
      header: 'Osoba kontaktowa',

      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      meta: { align: 'right' },
      enableSorting: true,
      cell: (info) => (
        <ActiveToggleBadge
          id={info.row.original.id}
          isActive={info.getValue() === 'active'}
          onToggle={onToggle}
          activeLabel="Aktywna"
          inactiveLabel="Zakończona"
        />
      ),
    }),
  ]
}
